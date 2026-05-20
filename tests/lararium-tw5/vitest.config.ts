const root = new URL(".", import.meta.url).pathname;

export default {
  root,
  test: {
    environment: "node",
    include: ["promote/**/*.test.ts"],
  },
};