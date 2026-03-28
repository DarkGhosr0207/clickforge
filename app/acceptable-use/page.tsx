import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "https://app.termly.io/policy-viewer/policy.html?policyUUID=bf2a00ae-a827-40a7-96ad-39c7682a0d1d"
  );
}
