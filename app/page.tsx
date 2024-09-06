import Image from "next/image";
import { SignUpForm } from "@/components/SignUpForm";
import { ExternalLink } from "@/components/ui/ExternalLink";

import logo from "@/public/logo.svg";
import Header from "@/components/Header";

export default async function Home() {
  return (
    <>
      <Header isRoot />
      <p>
        Meet the Hacker News community in your city.
        <br />
        Click the icons
        <Image
          src={logo}
          alt="meet.hn logo"
          width="20"
          height="20"
          className="mx-1 inline align-text-bottom"
        />
        on the map to list hackers from a city.
      </p>
      <SignUpForm />
      <p>
        If you do meet in real life and want to share a pic on Twitter, tag the{" "}
        <ExternalLink href="https://x.com/meet_hn" className="font-medium">
          @meet_hn
        </ExternalLink>{" "}
        account and I&apos;ll retweet you.
      </p>
    </>
  );
}
