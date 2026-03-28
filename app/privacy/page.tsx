import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "https://app.termly.io/policy-viewer/policy.html?policyUUID=105b65b8-6b3c-4726-bd25-8eea4dae6926"
  );
}
