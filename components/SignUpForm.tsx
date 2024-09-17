"use client";

import { useLocalStorage } from "@uidotdev/usehooks";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { addUser } from "@/app/_actions/addUser";
import { getCity } from "@/app/_actions/getCity";
import { getUser } from "@/app/_actions/getUser";
import { searchCity } from "@/app/_actions/searchCity";
import { CityWithoutMetadata, DbUser } from "@/app/_db/schema";
import { getClientUser } from "@/app/_db/User.client";
import { cn } from "@/app/_lib/utils";
import { CopyToClipboardBtn } from "@/components/CopyToClipboardBtn";
import { Social, supportedSocials } from "@/components/Socials";
import { AtHnInput, SocialSelector } from "@/components/SocialSelector";
import { SubmitButton } from "@/components/SubmitButton";
import { TagSelector } from "@/components/TagSelector";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValidatedInput } from "@/components/ValidatedInput";

import atHnLogoSrc from "@/public/at.hn.png";

export const fakeAtHnSocial = {
  name: "at.hn",
  logo: <Image src={atHnLogoSrc} alt="at.hn" className="h-5 w-5 shrink-0" />,
} as Social;

const supportedSocialsWithAtHn: Social[] = [
  fakeAtHnSocial,
  ...supportedSocials,
];

type FormState = {
  username: string;
  city: Pick<CityWithoutMetadata, "id" | "name" | "country"> | undefined;
  selectedSocials: (Pick<Social, "name" | "rootUrl"> & { value?: string })[];
  selectedTags: string[];
};

const initialState: FormState = {
  username: "",
  city: undefined,
  selectedSocials: [],
  selectedTags: [],
};

export function SignUpForm() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient ? <SignUpFormClient /> : <SignUpFormShell />;
}

function SignUpFormClient() {
  // Form action
  const [formState, formAction] = useFormState(addUser, undefined);

  // User input related state
  const [localState, saveStateToLocalStorage] = useLocalStorage(
    "signUpFormState",
    initialState,
  );
  const [username, setUsername] = useState<FormState["username"]>(
    localState.username,
  );
  const [knowUser, setKnownUser] = useState<DbUser>();
  const [city, setCity] = useState<FormState["city"]>(localState?.city);
  const [selectedSocials, setSelectedSocials] = useState<
    FormState["selectedSocials"]
  >(localState.selectedSocials);
  const selectedSocialsNames = selectedSocials.map((s) => s.name);
  const [selectedTags, setSelectedTags] = useState<FormState["selectedTags"]>(
    localState.selectedTags,
  );
  useEffect(() => {
    saveStateToLocalStorage({
      username: username,
      city: city,
      selectedSocials: selectedSocials,
      selectedTags: selectedTags,
    });
  }, [username, city, selectedSocials, selectedTags, saveStateToLocalStorage]);

  // Form control state
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  useEffect(() => {
    if (!formState?.wait) return;
    setIsFormDisabled(true);
    const timer = setTimeout(() => setIsFormDisabled(false), 1000 * 60);

    return () => clearTimeout(timer);
  }, [formState]);

  // if selectedSocial is selected already, we kick it from selectedSocials
  // otherwise we add it
  const handleSocialChange = (selectedSocial: Social) => {
    selectedSocialsNames.includes(selectedSocial.name)
      ? setSelectedSocials(
          selectedSocials.filter((s) => s.name !== selectedSocial.name),
        )
      : selectedSocial.name !== "at.hn"
        ? setSelectedSocials([...selectedSocials, selectedSocial])
        : setSelectedSocials([
            ...selectedSocials,
            { ...selectedSocial, value: `${username}.at.hn` },
          ]);
  };

  // if selectedTag is selected already, we kick it from selectedTags
  // otherwise we add it
  const handleTagChange = (selectedTag: string) =>
    selectedTags.includes(selectedTag)
      ? setSelectedTags(selectedTags.filter((t) => t !== selectedTag))
      : setSelectedTags([...selectedTags, selectedTag]);

  const handleAutofill = async () => {
    if (!knowUser) return;

    const knowUserCity = await getCity(knowUser?.cityId);
    setCity(knowUserCity);

    const knowClientUser = getClientUser(knowUser);

    if (knowClientUser.socials) {
      setSelectedSocials([
        ...knowClientUser.socials.map((social) => ({
          ...social,
          value: social.url?.replace("https://", ""),
        })),
        ...(knowClientUser.atHnUrl
          ? [
              {
                name: "at.hn",
                value: knowClientUser.atHnUrl.replace("https://", ""),
              } as unknown as Social,
            ] // hack to make at.hn fit in selectedSocials
          : []),
      ]);
    }

    if (knowClientUser.tags) {
      setSelectedTags(knowClientUser.tags);
    }
  };

  // Based on state, we create the content users will be able to copy
  // paste to their HN account
  const content = [
    city?.id ? `meet.hn/city/${city.id}` : undefined,
    selectedSocials.length > 0 || selectedTags.length > 0 ? "" : undefined,
    selectedSocials.length > 0 ? "Socials:" : undefined,
    ...selectedSocials.map((s) =>
      s.value !== undefined ? `- ${s.value}` : undefined,
    ),
    selectedSocials.length > 0 ? "" : undefined,
    selectedTags.length > 0 ? "Interests:" : undefined,
    selectedTags.length > 0 ? selectedTags.join(", ") : undefined,
    selectedSocials.length > 0 || selectedTags.length > 0 ? "" : undefined,
    selectedSocials.length > 0 || selectedTags.length > 0 ? "---" : undefined,
  ].filter((line): line is string => line !== undefined);

  const clipboardText = content.join("\n");

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-2">
      {/* Two main inputs */}
      <div className="grid grid-cols-1 grid-rows-1">
        <ValidatedInput
          className="[grid-area:1/1]"
          inputClassName="border-[#99999a]"
          validationFunction={getUser}
          onValidInput={setKnownUser}
          name="username"
          type="text"
          placeholder="HN username"
          defaultValue={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setKnownUser(undefined);
          }}
        />
        {knowUser === undefined ? null : (
          <WelcomeBtn onClick={handleAutofill} />
        )}
      </div>
      <ValidatedInput
        inputClassName="border-[#99999a]"
        validationFunction={async (value) => {
          const [rawCity, rawCountry] = value.split(",");
          if (!rawCity || !rawCountry) return;
          return await searchCity(rawCity, rawCountry);
        }}
        resetFunction={() => setCity(undefined)}
        onValidInput={setCity}
        error="City not found. Make sure you use the format: City, Country (Paris, France)"
        name="location"
        type="text"
        placeholder="City, Country (Paris, France)"
        defaultValue={city?.id ? `${city.name}, ${city.country}` : undefined}
      />

      {/* Dropdowns */}
      <div className="flex gap-2">
        <SocialSelector
          socials={supportedSocialsWithAtHn}
          selectedSocialsNames={selectedSocialsNames}
          onSocialSelected={handleSocialChange}
          disabled={username === "" || city === undefined}
        />
        <TagSelector
          selectedTags={selectedTags}
          onTagSelected={handleTagChange}
          disabled={username === "" || city === undefined}
        />
      </div>

      {/* Tags selected with the dropdown above */}
      {selectedTags.length === 0 ? null : (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {selectedTags.map((tag) => (
            <TagSelector.Tag key={tag} onClick={() => handleTagChange(tag)}>
              {tag}
            </TagSelector.Tag>
          ))}
        </div>
      )}

      {/*   
        Selected socials, with at.hn on the side at it is a special one
        whose value is already known without user input
      */}
      {selectedSocials.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          {selectedSocialsNames.includes("at.hn") && (
            <AtHnInput
              username={username}
              onDelete={() => handleSocialChange(fakeAtHnSocial)}
            />
          )}
          {selectedSocials
            .filter((s) => s.name !== "at.hn")
            .map((social) => (
              <SocialSelector.Input
                key={social.name}
                social={supportedSocials.find((s) => s.name === social.name)!} // Warning: type assertion
                onChange={(social, value) => {
                  const existingSocialIdx = selectedSocials.findIndex(
                    (s) => s.name === social.name,
                  );
                  if (existingSocialIdx < 0) return;
                  selectedSocials[existingSocialIdx] = {
                    ...social,
                    value: `${social.rootUrl}${value}`,
                  };
                  setSelectedSocials([...selectedSocials]);
                }}
                onDelete={(social) => {
                  setSelectedSocials([
                    ...selectedSocials.filter((s) => s.name !== social.name),
                  ]);
                }}
                defaultValue={social.value?.replace(social.rootUrl, "")}
              />
            ))}
        </div>
      )}

      {/* Content to copy */}
      <p className="mt-8 md:max-w-[75%]">
        Fill out the form, then copy and paste the text below into your HN
        account.
      </p>
      <div
        className={cn(
          "grid grid-cols-1 grid-rows-1 rounded-sm border border-[#aaaaa4e3] bg-[#e3e3dce3] px-2 py-1",
          content.length === 0 && "pointer-events-none opacity-50",
        )}
      >
        <div className="col-start-1 row-start-1 w-full">
          {content.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <CopyToClipboardBtn
          text={clipboardText}
          className="col-start-1 row-start-1 place-self-end self-end fill-black p-1"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          className={cn(
            buttonVariants({ variant: "outline" }),
            username === "" && "pointer-events-none opacity-50",
            "border-[#e15b02] bg-transparent text-[#e15b02] hover:bg-transparent hover:text-[#e15b02]",
          )}
          href={`https://news.ycombinator.com/user?id=${username}`}
          target="_blank"
        >
          Open my HN account
        </Link>
        <SubmitButton
          className="bg-[#ff6602] hover:bg-[#e15b02]"
          disabled={isFormDisabled || username === "" || city === undefined}
        >
          Add me on the map
        </SubmitButton>
      </div>
      {formState && Object.keys(formState).length > 0 && (
        <div className="text-sm text-red-800 md:max-w-[75%]">
          {formState.message}
        </div>
      )}
    </form>
  );
}

function SignUpFormShell() {
  return (
    <form className="flex max-w-xl flex-col gap-2">
      {/* Two main inputs */}
      <Input
        name="username"
        type="text"
        placeholder="HN username"
        className="border-[#99999a]"
      />
      <Input
        name="location"
        type="text"
        placeholder="City, Country (Paris, France)"
        className="border-[#99999a]"
      />

      {/* Dropdowns */}
      <div className="flex gap-2">
        <SocialSelector
          socials={supportedSocialsWithAtHn}
          selectedSocialsNames={[]}
          onSocialSelected={() => 42}
          disabled={true}
        />
        <TagSelector
          selectedTags={[]}
          onTagSelected={() => 42}
          disabled={true}
        />
      </div>

      {/* Content to copy */}
      <p className="mt-8 md:max-w-[75%]">
        Fill out the form, then copy and paste the text below into your HN
        account.
      </p>
      <div className="pointer-events-none grid grid-cols-1 grid-rows-1 rounded-sm border border-[#aaaaa4e3] bg-[#e3e3dce3] px-2 py-1 opacity-50">
        <div className="col-start-1 row-start-1 w-full"></div>
        <CopyToClipboardBtn
          text="42"
          className="col-start-1 row-start-1 place-self-end self-end fill-black p-1"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          className={cn(
            buttonVariants({ variant: "outline" }),
            "pointer-events-none border-[#e15b02] bg-transparent text-[#e15b02] opacity-50 hover:bg-transparent hover:text-[#e15b02]",
          )}
          href={`#`}
          target="_blank"
        >
          Open my HN account
        </Link>
        <SubmitButton
          className="bg-[#ff6602] hover:bg-[#e15b02]"
          disabled={true}
        >
          Add me on the map
        </SubmitButton>
      </div>
    </form>
  );
}

const WelcomeBtn = ({ onClick }: { onClick: () => any }) => {
  const [activeStep, setActiveStep] = useState<0 | 1 | undefined>(0);
  const steps = ["Welcome back!", "Click to autofill ➡️"];

  const sleep = (delay: number) =>
    new Promise((resolve) => setTimeout(resolve, delay));

  useEffect(() => {
    const animation = async () => {
      const one = await sleep(1500);
      setActiveStep(1);
      const two = await sleep(2000);
      setActiveStep(undefined);
      return [one, two];
    };
    animation();
  }, []);

  return (
    <div className="flex items-center self-center justify-self-end px-3 text-xl [grid-area:1/1]">
      {activeStep === undefined ? null : (
        <span
          className={cn(
            "mr-2 rounded-sm bg-gray-700 px-2 py-1 text-xs text-white opacity-100 transition-opacity slide-in-from-top-2",
          )}
        >
          {steps[activeStep]}
        </span>
      )}
      <button type="button" onClick={onClick}>
        👋
      </button>
    </div>
  );
};
