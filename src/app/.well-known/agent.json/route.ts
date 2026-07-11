export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    {
      name: "TETA+PI Verification Protocol",
      version: "1.3.0",
      description:
        "Trust infrastructure for digital entities — universal verification of people, companies, APIs, AI models, MCP servers, and agents via official registries, C2PA-signed media, and Bitcoin OpenTimestamps.",
      mcp_endpoint: "https://mcp.tetapi.dev",
      api_endpoint: "https://api.tetapi.dev/api/v1",
      capabilities: [
        "entity_verification",
        "endpoint_verification",
        "intent_routing",
        "c2pa_media_verification",
        "bitcoin_timestamping",
      ],
      entity_types: [
        "person",
        "business",
        "organization",
        "brand",
        "domain",
        "website",
        "api",
        "ai_model",
        "mcp_server",
        "software",
        "repository",
        "ai_agent",
      ],
      verification_levels: ["registry_attested", "c2pa_verified", "btc_confirmed"],
      mcp_tools: [
        "teta_search",
        "teta_verify_entity",
        "teta_verify_endpoint",
        "teta_get_proof",
        "teta_resolve_intent",
        "teta_get_profile",
        "teta_verify_claim",
      ],
      registries: [
        "Germany Handelsregister",
        "Ukraine EDR",
        "UK Companies House",
        "US SEC EDGAR + state registries (NY DOS, CO SOS)",
        "France SIRENE (recherche-entreprises)",
        "Czech ARES",
        "Finland PRH",
        "Norway Brønnøysundregistrene",
        "GLEIF (global LEI)",
        "OpenCorporates (200+ jurisdictions)",
      ],
      contact: "protocol@tetapi.dev",
      spec: "https://tetapi.dev/protocol/v1",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
