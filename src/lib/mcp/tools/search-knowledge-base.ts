import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const SUPABASE_URL = "https://ogkltfqvzweeqkfmrzts.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2x0ZnF2endlZXFrZm1yenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODc4OTIsImV4cCI6MjA5MjQ2Mzg5Mn0.Bqn76pQvh5f0lfDoucMB8BAo9y3Fs4vnVslbwGg73-g";

export default defineTool({
  name: "search_knowledge_base",
  title: "Search public knowledge base",
  description:
    "Search the public Quero Armas legal knowledge base (laws, norms, help articles) and return a synthesized answer with citations. Use for questions about CAC, posse, porte, Exército, Polícia Federal norms.",
  inputSchema: {
    query: z
      .string()
      .min(3)
      .max(500)
      .describe("Natural language question in Portuguese about Brazilian firearm regulations."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query }) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/qa-kb-search-cliente`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ query }),
      });
      const text = await r.text();
      if (!r.ok) {
        return {
          content: [{ type: "text", text: `Erro na busca (${r.status}): ${text.slice(0, 500)}` }],
          isError: true,
        };
      }
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { content: [{ type: "text", text }] };
      }
      const answer = parsed?.answer ?? "Sem resposta.";
      const artigos = Array.isArray(parsed?.articles) ? parsed.articles : [];
      const cites = artigos
        .slice(0, 5)
        .map((a: any, i: number) => `${i + 1}. ${a.title ?? a.titulo ?? "artigo"}`)
        .join("\n");
      const out = cites ? `${answer}\n\nFontes:\n${cites}` : answer;
      return {
        content: [{ type: "text", text: out }],
        structuredContent: { answer, articles: artigos },
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Falha ao chamar a base: ${e?.message ?? String(e)}` }],
        isError: true,
      };
    }
  },
});