import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "https://app.termly.io/policy-viewer/policy.html?policyUUID=b1cbd7f4-eb4c-4357-9a1f-cbac3a82cfa5"
  );
}
