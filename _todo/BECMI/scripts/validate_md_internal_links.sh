#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <markdown-file> [more-files...]" >&2
  exit 2
fi

perl -CS -Mutf8 - "$@" <<'PERL'
use strict;
use warnings;

sub slugify {
  my ($text) = @_;
  my $slug = lc($text);
  $slug =~ s/[\x{2000}-\x{206F}\x{2E00}-\x{2E7F}!"#\$%&'\(\)\*\+,\.\/:;<=>\?@\[\\\]\^_`\{\|\}~]//g;
  # Preserve repeated spaces created by punctuation removal (e.g. "A & B" -> "a--b").
  $slug =~ s/ /-/g;
  $slug =~ s/\t/-/g;
  return $slug;
}

sub suggest {
  my ($frag, $id_ref) = @_;
  my @ids = keys %{$id_ref};
  return () unless @ids;

  my ($first) = split /-/, $frag;
  my @cands = grep { index($_, $first) >= 0 } @ids;
  @cands = @ids if !@cands;
  @cands = sort { abs(length($a) - length($frag)) <=> abs(length($b) - length($frag)) } @cands;
  splice(@cands, 3) if @cands > 3;
  return @cands;
}

my $bad = 0;
for my $file (@ARGV) {
  open my $fh, '<:encoding(UTF-8)', $file or do {
    warn "$file: cannot open: $!\n";
    $bad = 1;
    next;
  };

  my (%ids, %seen, @links);
  my $ln = 0;
  my $in_fence = 0;

  while (my $line = <$fh>) {
    $ln++;

    # Respect fenced code blocks.
    if ($line =~ /^\s*```/ || $line =~ /^\s*~~~/) {
      $in_fence = !$in_fence;
      next;
    }

    while ($line =~ /<a\s+id="([^"]+)"/ig) {
      $ids{$1} = 1;
    }

    next if $in_fence;

    if ($line =~ /^\s*(?:>\s*){0,6}(#{1,6})\s+(.+?)\s*$/) {
      my $h = $2;
      $h =~ s/\s+#+$//;
      my $slug = slugify($h);

      my $base = $slug;
      if (exists $seen{$base}) {
        $seen{$base}++;
        $slug = $base . '-' . $seen{$base};
      } else {
        $seen{$base} = 0;
      }
      $ids{$slug} = 1;
    }

    while ($line =~ /\]\(#([^\)]+)\)/g) {
      push @links, [$1, $ln, 'md'];
    }
    while ($line =~ /href="#([^"]+)"/g) {
      push @links, [$1, $ln, 'html'];
    }
  }
  close $fh;

  my @unresolved = grep { !$ids{$_->[0]} } @links;
  if (@unresolved) {
    print "$file\n";
    for my $u (@unresolved) {
      my ($frag, $line_no) = ($u->[0], $u->[1]);
      my @s = suggest($frag, \%ids);
      my $hint = @s ? (' (did you mean: ' . join(', ', map { "#$_" } @s) . '?)') : '';
      print "  L$line_no: #$frag$hint\n";
    }
    $bad = 1;
  }
}

exit($bad ? 1 : 0);
PERL
