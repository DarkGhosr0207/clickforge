import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "https://app.termly.io/policy-viewer/policy.html?policyUUID=d7899220-31f6-4442-b790-d39e38065968"
  );
}
