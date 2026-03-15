import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-sm",
          },
        }}
        fallbackRedirectUrl="/tool"
        signUpUrl="/sign-up"
      />
    </main>
  );
}
