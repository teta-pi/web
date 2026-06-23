export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    {
      name: "TETA+PI Verification Protocol",
      version: "1.0",
      description: "Trust infrastructure for the agent economy — open verification of businesses, people, and organizations via official registries, C2PA-signed media, and Bitcoin OpenTimestamps.",
      mcp_endpoint: "https://tetapi.io/mcp",
      api_endpoint: "https://tetapi.io/api/v1",
      capabilities: [
        "entity_verification",
        "endpoint_verification",
        "intent_routing",
        "c2pa_media_verification",
        "bitcoin_timestamping",
      ],
      entity_types: ["business", "person", "organization"],
      verification_levels: [
        "registry_attested",
        "c2pa_verified",
        "btc_confirmed",
      ],
      mcp_tools: [
        "search_entities",
        "get_business_profile",
        "verify_business_claim",
        "get_verification_proof",
        "verify_endpoint",
        "search_verified_businesses",
      ],
      registries: ["Ukraine EDR", "Germany Handelsregister", "UK Companies House", "Singapore ACRA"],
      contact: "protocol@tetapi.io",
      spec: "https://tetapi.io/protocol/v1",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
