import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-sm",
          },
        }}
        fallbackRedirectUrl="/tool"
        signInUrl="/sign-in"
      />
    </main>
  );
}
