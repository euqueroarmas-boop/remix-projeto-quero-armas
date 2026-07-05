import { defineMcp } from "@lovable.dev/mcp-js";
import searchKnowledgeBaseTool from "./tools/search-knowledge-base";

export default defineMcp({
  name: "quero-armas-mcp",
  title: "Quero Armas MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas públicas do Quero Armas. Use `search_knowledge_base` para consultar a base pública de legislação e artigos sobre CAC, posse, porte e normas do Exército e Polícia Federal brasileira.",
  tools: [searchKnowledgeBaseTool],
});