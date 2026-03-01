import { visit } from "unist-util-visit";

export default function rehypeAddClasses() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "h1") {
        node.properties = node.properties || {};
        node.properties.className = ["text-4xl font-bold my-6"];
      }
      if (node.tagName === "h2") {
        node.properties = node.properties || {};
        node.properties.className = ["text-3xl font-semibold my-4"];
      }
      if (node.tagName === "p") {
        node.properties = node.properties || {};
        node.properties.className = ["text-zinc-300 my-2"];
      }
      if (node.tagName === "ul") {
        node.properties = node.properties || {};
        node.properties.className = ["list-disc list-inside my-2"];
      }
    });
  };
}