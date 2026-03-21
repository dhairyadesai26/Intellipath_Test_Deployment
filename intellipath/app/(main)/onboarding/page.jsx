import { industries } from "@/data/industries";
import OnboardingForm from "./_components/onboarding-form";
import { getUserProfile } from "@/actions/user";

export default async function OnboardingPage() {
  const userProfile = await getUserProfile();

  return (
    <main>
      <OnboardingForm industries={industries} initialData={userProfile} />
    </main>
  );
}
