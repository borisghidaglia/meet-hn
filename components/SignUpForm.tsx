"use client";

import { useLocalStorage } from "@uidotdev/usehooks";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { addUser } from "@/app/_actions/addUser";
import { getCity } from "@/app/_actions/getCity";
import { getUser } from "@/app/_actions/getUser";
import { CityWithoutMetadata, DbUser } from "@/app/_db/schema";
import { getClientUser } from "@/app/_db/User.client";
import { cn, debounce } from "@/app/_lib/utils";
import { CitySelector } from "@/components/CitySelector";
import { CopyToClipboardBtn } from "@/components/CopyToClipboardBtn";
import {
  getBareValue,
  getSavedValue,
  Social,
  supportedSocials,
} from "@/components/Socials";
import { SocialSelector } from "@/components/SocialSelector";
import { SubmitButton } from "@/components/SubmitButton";
import { TagSelector } from "@/components/TagSelector";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormState = {
  username: string;
  city: CityWithoutMetadata | undefined;
  selectedSocialsNamesToValue?: { [key in Social["name"]]?: string };
  selectedTags: string[];
};

const initialState: FormState = {
  username: "",
  city: undefined,
  selectedSocialsNamesToValue: undefined,
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
  // User input related state
  const [localState, saveStateToLocalStorage] = useLocalStorage(
    "signUpFormState",
    initialState,
  );
  const [username, setUsername] = useState<FormState["username"]>(
    localState.username,
  );
  const [knowUser, setKnownUser] = useState<DbUser>();
  const [city, setCity] = useState<FormState["city"]>(localState.city);
  const [selectedSocialsNamesToValue, setSelectedSocialsNamesToValue] =
    useState<FormState["selectedSocialsNamesToValue"] | undefined>(
      localState.selectedSocialsNamesToValue,
    );
  const [selectedTags, setSelectedTags] = useState<FormState["selectedTags"]>(
    localState.selectedTags,
  );
  useEffect(() => {
    saveStateToLocalStorage({
      username,
      city,
      selectedSocialsNamesToValue,
      selectedTags,
    });
  }, [
    username,
    city,
    selectedSocialsNamesToValue,
    selectedTags,
    saveStateToLocalStorage,
  ]);

  // Form action
  const [formState, formAction] = useFormState(
    addUser.bind(null, city),
    undefined,
  );

  // Form control state
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  useEffect(() => {
    if (!formState?.wait) return;
    setIsFormDisabled(true);
    const timer = setTimeout(() => setIsFormDisabled(false), 1000 * 60);

    return () => clearTimeout(timer);
  }, [formState]);

  const handleSocialChange = (name: Social["name"]) => {
    const newSelectedSocialsNameToValue = selectedSocialsNamesToValue ?? {};

    if (name in newSelectedSocialsNameToValue) {
      delete newSelectedSocialsNameToValue[name];
    } else {
      // at.hn is the only value that can be filled without user's input
      newSelectedSocialsNameToValue[name] =
        name === "at.hn" ? `${username}.at.hn` : "";
    }

    setSelectedSocialsNamesToValue({ ...newSelectedSocialsNameToValue });
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
      const newSelectedSocialsNameToValue: FormState["selectedSocialsNamesToValue"] =
        {};
      for (const social of knowClientUser.socials) {
        newSelectedSocialsNameToValue[social.name] = social.value;
      }
      setSelectedSocialsNamesToValue(newSelectedSocialsNameToValue);
    }

    if (knowClientUser.tags) {
      setSelectedTags(knowClientUser.tags);
    }
  };

  const debouncedGetUser = useCallback(
    debounce(async (input: string) => {
      const user = await getUser(input);
      setKnownUser(user);
    }, 300),
    [],
  );

  const sortedSelectedSocials = Object.entries(
    selectedSocialsNamesToValue ?? {},
  ).sort(([nameA, vA], [nameB, vB]) =>
    nameA.toLowerCase() > nameB.toLowerCase() ? 1 : -1,
  ) as [Social["name"], string][];
  const sortedSelectedTags = selectedTags.sort();

  // Based on state, we create the content users will be able to copy
  // paste to their HN account
  const areSomeSocialsSelected = selectedSocialsNamesToValue
    ? sortedSelectedSocials.length > 0 &&
      sortedSelectedSocials.some(
        ([name, value]) => value !== "" && value !== undefined,
      )
    : false;
  const content = [
    city?.id
      ? `meet.hn/city/${city.id}/${city.name.split(" ").join("-")}`
      : undefined,
    areSomeSocialsSelected || selectedTags.length > 0 ? "" : undefined,
    areSomeSocialsSelected ? "Socials:" : undefined,
    ...sortedSelectedSocials.map(([name, value]) =>
      value !== "" && value !== undefined ? `- ${value}` : undefined,
    ),
    areSomeSocialsSelected ? "" : undefined,
    selectedTags.length > 0 ? "Interests:" : undefined,
    selectedTags.length > 0 ? selectedTags.join(", ") : undefined,
    areSomeSocialsSelected || selectedTags.length > 0 ? "" : undefined,
    areSomeSocialsSelected || selectedTags.length > 0 ? "---\n" : undefined,
  ].filter((line): line is string => line !== undefined);

  const clipboardText = content.join("\n");

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-2">
      {/* Two main inputs */}
      <div className="grid grid-cols-1 grid-rows-1">
        <Input
          className="border-[#99999a] [grid-area:1/1]"
          name="username"
          type="text"
          placeholder="HN username"
          defaultValue={username}
          onChange={(e) => {
            setUsername(e.target.value);
            debouncedGetUser(e.target.value);
          }}
        />
        {knowUser === undefined ? null : (
          <WelcomeBtn onClick={handleAutofill} />
        )}
      </div>
      <CitySelector
        key={city?.name}
        onSelect={setCity}
        initialValue={city?.name}
      />

      {/* Dropdowns */}
      <div className="flex gap-2">
        <SocialSelector
          socials={supportedSocials}
          selectedSocialsNames={sortedSelectedSocials.map(
            ([name, value]) => name,
          )}
          onSocialSelected={handleSocialChange}
          disabled={username === "" || city === undefined}
        />
        <TagSelector
          selectedTags={sortedSelectedTags}
          onTagSelected={handleTagChange}
          disabled={username === "" || city === undefined}
        />
      </div>

      {/* Tags selected with the dropdown above */}
      {sortedSelectedTags.length === 0 ? null : (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {sortedSelectedTags.map((tag) => (
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
      {selectedSocialsNamesToValue === undefined ||
      sortedSelectedSocials.length <= 0 ? null : (
        <div className="flex flex-col gap-2">
          {sortedSelectedSocials.map(([name, value]) => {
            const selectedSocial = supportedSocials.find(
              (s) => s.name === name,
            );
            if (selectedSocial === undefined) return null;

            return (
              <SocialSelector.Input
                key={selectedSocial.name}
                social={selectedSocial}
                onChange={(social, value) => {
                  selectedSocialsNamesToValue[social.name] = getSavedValue(
                    social.name,
                    value,
                  );
                  setSelectedSocialsNamesToValue({
                    ...selectedSocialsNamesToValue,
                  });
                }}
                onDelete={(social) => {
                  delete selectedSocialsNamesToValue[social.name];
                  setSelectedSocialsNamesToValue({
                    ...selectedSocialsNamesToValue,
                  });
                }}
                value={getBareValue(name, value)}
              />
            );
          })}
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
        <div
          className="col-start-1 row-start-1 w-full"
          data-testid="generated-text"
        >
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
          socials={supportedSocials}
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
