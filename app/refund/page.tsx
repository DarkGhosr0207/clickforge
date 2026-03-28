import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "https://app.termly.io/policy-viewer/policy.html?policyUUID=04ae6aa7-b32e-4f9c-b7e9-a76574cd49ad"
  );
}
