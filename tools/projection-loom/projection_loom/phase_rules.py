"""Pure OODA-HA phase gates. No event log, filesystem, or second helm.

The noosphere/Projection Loom contract has five active phases: Observe,
Orient, Decide, Act and Aftermath. 'closed' is the terminal boundary,
not a sixth action. Only OODAJournal mutates and persists actual loops.
"""


PHASES = ('observe', 'orient', 'decide', 'act', 'aftermath', 'closed')


def next_phase_allowed(loops, loop_id, phase):
    """Validate an adjacent transition without modifying the phase tree.

    Return False for an idempotent same-phase replay; True for the next
    legal phase. The caller owns receipt serialization, events and saves.
    """
    if phase not in PHASES:
        raise ValueError('Unknown OODA-HA phase')
    node = loops[loop_id]
    prior = PHASES.index(node['phase'])
    target = PHASES.index(phase)
    if target == prior:
        return False
    if target != prior + 1:
        raise ValueError(f'Illegal OODA-HA phase transition: {node["phase"]} -> {phase}')
    open_children = [child for child in node['children']
                     if loops[child]['phase'] != 'closed']
    if open_children:
        raise ValueError(f'Parent phase {node["phase"]} awaits child loops: {open_children}')
    return True


def child_phase_anchor(loops, parent, *, parent_phase, max_depth):
    """Find the immutable parent-phase anchor and bounded child depth.

    Loop identity/idempotent reentry and evidence serialization remain in
    the journal. No helper can create a child or advance the parent.
    """
    if parent is None:
        if parent_phase is not None:
            raise ValueError('A root loop has no parent phase')
        return None, 0
    node = loops.get(parent)
    if node is None or node['phase'] == 'closed':
        raise ValueError('A child needs an active parent loop')
    if parent_phase is not None and node['phase'] != parent_phase:
        raise ValueError('Parent phase changed before child was attached')
    depth = node['depth'] + 1
    if depth > max_depth:
        raise ValueError('OODA recursion depth budget reached')
    return node['phase'], depth
