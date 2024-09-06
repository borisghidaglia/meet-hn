import { DeleteForm } from "@/components/DeleteForm";

export default function DeletePage() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p>
        To delete your account, remove all the meet.hn informations from your HN
        description and click on the button below.
      </p>
      <DeleteForm />
    </div>
  );
}
