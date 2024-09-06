import { FeedbackForm } from "@/components/FeedbackForm";
import { ExternalLink } from "@/components/ui/ExternalLink";

export default function FeedbackPage() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p>Any feedback is welcome and appreciated.</p>
      <p>
        You can drop me a DM on Twitter{" "}
        <ExternalLink
          href="https://x.com/borisfyi"
          target="_blank"
          className="font-medium"
        >
          @borisfyi
        </ExternalLink>{" "}
        or send a line to <b className="font-medium">feedback@meet.hn</b>
      </p>
      <p>Otherwise, you can also use the form below.</p>
      <FeedbackForm />
    </div>
  );
}
