import ContributionsPageContent from "@/components/dasboard/manage-contributions/contributions-page-content";
import ContributionsProvider from "@/components/dasboard/manage-contributions/contributions-provider";

export default function AdminContributionsPage() {
  return (
    <ContributionsProvider>
      <ContributionsPageContent />
    </ContributionsProvider>
  );
}
