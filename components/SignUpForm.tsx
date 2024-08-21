"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer } from "react";
import { useFormState } from "react-dom";

import { addUser } from "@/app/_actions/addUser";
import { fetchCity } from "@/app/_db/City";
import { CopyToClipboardBtn } from "@/components/CopyToClipboardBtn";
import {
  Social,
  SupportedSocialName,
  supportedSocials,
} from "@/components/Socials";
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
  city: string;
  selectedSocials: Social[];
  selectedTags: string[];
  socials: { [key in SupportedSocialName]?: string };
  isFormDisabled: boolean;
};

const initialState: FormState = {
  username: "",
  city: "",
  selectedSocials: [],
  selectedTags: [],
  socials: {},
  isFormDisabled: false,
};

type FormAction =
  | { type: "SET_USERNAME"; payload: FormState["username"] }
  | { type: "SET_CITY"; payload: FormState["city"] }
  | { type: "SET_SELECTED_SOCIALS"; payload: FormState["selectedSocials"] }
  | { type: "SET_SELECTED_TAGS"; payload: FormState["selectedTags"] }
  | { type: "SET_SOCIAL_VALUES"; payload: FormState["socials"] }
  | { type: "SET_FORM_DISABLED"; payload: FormState["isFormDisabled"] };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_USERNAME":
      return { ...state, username: action.payload };
    case "SET_CITY":
      return { ...state, city: action.payload };
    case "SET_SELECTED_SOCIALS":
      return { ...state, selectedSocials: action.payload };
    case "SET_SELECTED_TAGS":
      return { ...state, selectedTags: action.payload };
    case "SET_SOCIAL_VALUES":
      return { ...state, socials: action.payload };
    case "SET_FORM_DISABLED":
      return { ...state, isFormDisabled: action.payload };
    default:
      return state;
  }
}

export function SignUpForm(): JSX.Element {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const [formState, formAction] = useFormState(addUser, undefined);

  const selectedSocialNames = state.selectedSocials.map((s) => s.name);

  useEffect(() => {
    if (!formState?.wait) return;

    dispatch({ type: "SET_FORM_DISABLED", payload: true });
    const timer = setTimeout(
      () => dispatch({ type: "SET_FORM_DISABLED", payload: false }),
      1000 * 60,
    );

    return () => clearTimeout(timer);
  }, [formState]);

  const handleInputChange = (name: SupportedSocialName, value: string) => {
    dispatch({
      type: "SET_SOCIAL_VALUES",
      payload: {
        ...state.socials,
        [name]: value,
      },
    });
  };

  const handleSocialChange = (social?: Social) => {
    if (!social) return;
    const socialName = social.name;
    let newSelectedSocials: Social[] = [];

    if (selectedSocialNames.includes(socialName)) {
      newSelectedSocials = [
        ...state.selectedSocials.filter((s) => s.name !== socialName),
      ];
    } else {
      const selectedSocial = supportedSocialsWithAtHn.find(
        (s) => s.name === socialName,
      );
      if (!selectedSocial) return;
      newSelectedSocials = [...state.selectedSocials, selectedSocial];
    }

    dispatch({ type: "SET_SELECTED_SOCIALS", payload: newSelectedSocials });

    if (socialName === "at.hn") {
      // then we manually handle social values changes
      if (!selectedSocialNames.includes(socialName)) {
        handleInputChange(
          socialName as SupportedSocialName,
          `${state.username}.at.hn`,
        );
      } else {
        delete state.socials[socialName as SupportedSocialName];
        dispatch({
          type: "SET_SOCIAL_VALUES",
          payload: state.socials,
        });
      }
    }
  };

  const handleTagChange = (tag: string) => {
    const newSelectedTags = state.selectedTags.includes(tag)
      ? state.selectedTags.filter((t) => t !== tag)
      : [...state.selectedTags, tag];

    dispatch({ type: "SET_SELECTED_TAGS", payload: newSelectedTags.sort() });
  };

  const content = [
    state.city
      ? `${Object.values(state.socials).length > 0 || state.selectedTags.length > 0 ? "### " : ""}meet.hn/?city=${state.city}`
      : undefined,
    state.city &&
    (Object.values(state.socials).length > 0 || state.selectedTags.length > 0)
      ? ""
      : undefined,
    Object.values(state.socials).length > 0 ? "Socials:" : undefined,
    ...Object.values(state.socials).map((s) => `- ${s}`),
    Object.values(state.socials).length > 0 ? "" : undefined,
    state.selectedTags.length > 0 ? "Interests:" : undefined,
    state.selectedTags.length > 0 ? state.selectedTags.join(", ") : undefined,
    state.city &&
    (Object.values(state.socials).length > 0 || state.selectedTags.length > 0)
      ? ""
      : undefined,
    state.city &&
    (Object.values(state.socials).length > 0 || state.selectedTags.length > 0)
      ? "---"
      : undefined,
  ].filter((line): line is string => line !== undefined);

  const clipboardText = content.join("\n");

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-2">
      <Input
        name="username"
        type="text"
        value={state.username}
        onChange={(e) =>
          dispatch({ type: "SET_USERNAME", payload: e.target.value })
        }
        placeholder="HN username"
        className="border-[#99999a]"
      />
      <ValidatedInput
        validationFunction={async (value: string) => {
          const [rawCity, rawCountry] = value.split(",");
          if (!rawCity || !rawCountry) return;
          return await fetchCity(rawCity, rawCountry);
        }}
        onValidInput={(city: { id: string }) =>
          dispatch({ type: "SET_CITY", payload: city.id })
        }
        resetFunction={() => dispatch({ type: "SET_CITY", payload: "" })}
        error="City not found. Make sure you use the format: City, Country (Paris, France)"
        name="location"
        type="text"
        placeholder="City, Country (Paris, France)"
        className="border-[#99999a]"
      />
      <div className="flex gap-2">
        <SocialSelector
          socials={supportedSocialsWithAtHn}
          selectedSocials={state.selectedSocials}
          onSocialSelected={handleSocialChange}
          disabled={state.username.length === 0}
        />
        <TagSelector
          selectedTags={state.selectedTags}
          onTagSelected={handleTagChange}
          disabled={state.username.length === 0}
        />
      </div>
      {state.selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {state.selectedTags.map((tag) => (
            <TagSelector.Tag key={tag} onClick={() => handleTagChange(tag)}>
              {tag}
            </TagSelector.Tag>
          ))}
        </div>
      ) : null}
      {state.selectedSocials.length > 0 ? (
        <div className="flex flex-col gap-2">
          {selectedSocialNames.includes("at.hn") && (
            <AtHnInput
              username={state.username}
              onDelete={() => handleSocialChange(fakeAtHnSocial)}
            />
          )}
          {state.selectedSocials
            .filter((s) => s.name !== "at.hn")
            .map((social) => {
              return social ? (
                <SocialSelector.Input
                  key={social.name}
                  social={social}
                  onChange={(social, value) =>
                    handleInputChange(
                      social.name as SupportedSocialName,
                      social.rootUrl + value,
                    )
                  }
                  onDelete={() => {
                    handleSocialChange(social);
                    delete state.socials[social.name as SupportedSocialName];
                    dispatch({
                      type: "SET_SOCIAL_VALUES",
                      payload: state.socials,
                    });
                  }}
                />
              ) : null;
            })}
        </div>
      ) : null}
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
            <p key={line !== "" ? line : i}>{line}</p>
          ))}
        </div>
        <CopyToClipboardBtn
          text={clipboardText}
          className="col-start-1 row-start-1 place-self-end self-end fill-black p-1"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Link
          aria-disabled={true}
          className={cn(
            buttonVariants({ variant: "outline" }),
            state.username.length === 0 && "pointer-events-none opacity-50",
            "border-[#e15b02] bg-transparent text-[#e15b02] hover:bg-transparent hover:text-[#e15b02]",
          )}
          href={`https://news.ycombinator.com/user?id=${state.username}`}
          target="_blank"
        >
          Open my HN account
        </Link>
        <SubmitButton
          disabled={state.isFormDisabled || !state.username || !state.city}
          className="bg-[#ff6602] hover:bg-[#e15b02]"
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
