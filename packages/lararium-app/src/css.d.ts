// Ambient declaration for CSS side-effect imports (e.g. tldraw/tldraw.css)
declare module "*.css" {
  const _: string;
  export default _;
}
