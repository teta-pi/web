export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    {
      name: "TETA+PI Verification Protocol",
      version: "1.0",
      description:
        "Trust infrastructure for the agent economy — universal verification of businesses, journalists, artists, and organizations via official registries, C2PA-signed media, and Bitcoin OpenTimestamps.",
      mcp_endpoint: "https://mcp.tetapi.dev",
      api_endpoint: "https://api.tetapi.dev/api/v1",
      capabilities: [
        "entity_verification",
        "endpoint_verification",
        "intent_routing",
        "c2pa_media_verification",
        "bitcoin_timestamping",
      ],
      entity_types: ["business", "person", "organization"],
      verification_levels: ["registry_attested", "c2pa_verified", "btc_confirmed"],
      mcp_tools: [
        "teta_search",
        "teta_verify_entity",
        "teta_verify_claim",
        "teta_get_proof",
        "teta_verify_endpoint",
      ],
      registries: [
        "GLEIF (global)",
        "SEC EDGAR (US)",
        "Ukraine EDR",
        "Germany Handelsregister",
        "UK Companies House",
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
