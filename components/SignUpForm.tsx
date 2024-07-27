"use client";

import Image from "next/image";
import { useEffect, useReducer } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { addUser } from "@/app/_actions/addUser";
import { fetchCity } from "@/app/_db/City";
import { CopyToClipboardBtn } from "@/components/CopyToClipboardBtn";
import {
  Social,
  SupportedSocialName,
  supportedSocials,
} from "@/components/Socials";
import { AtHnInput, SocialSelector } from "@/components/SocialSelector";
import { TagSelector } from "@/components/TagSelector";
import { Button, ButtonProps } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Input } from "@/components/ui/input";
import { ValidatedInput } from "@/components/ValidatedInput";

import atHnLogoSrc from "@/static/at.hn.png";

export const fakeAtHnSocial = {
  name: "at.hn",
  logo: <Image src={atHnLogoSrc} alt="at.hn" className="h-5 w-5 shrink-0" />,
} as Social;

const supportedSocialsWithAtHn: Social[] = [
  fakeAtHnSocial,
  ...supportedSocials,
];

interface FormState {
  username: string;
  city: string;
  selectedSocials: Social[];
  selectedTags: string[];
  socials: { [key in SupportedSocialName]?: string };
  isFormDisabled: boolean;
}

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

interface SignUpFormProps {
  uuid: string;
}

export function SignUpForm({ uuid }: SignUpFormProps): JSX.Element {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const [formState, formAction] = useFormState(
    addUser.bind(null, uuid),
    undefined,
  );

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

    dispatch({ type: "SET_SELECTED_TAGS", payload: newSelectedTags });
  };

  const content = [
    state.city ? `meet.hn/?city=${state.city}` : undefined,
    Object.values(state.socials).length > 0 ? "# Socials" : undefined,
    ...Object.values(state.socials),
    state.selectedTags.length > 0 ? "# Tags" : undefined,
    state.selectedTags.length > 0 ? state.selectedTags.join(", ") : undefined,
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
        error="City not found. Make sure you use the same format as the placeholder."
        name="location"
        type="text"
        placeholder="City, Country"
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
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {state.selectedTags.map((tag) => (
          <TagSelector.Tag key={tag} onClick={() => handleTagChange(tag)}>
            {tag}
          </TagSelector.Tag>
        ))}
      </div>
      <div className="flex flex-col gap-3">
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
      <div className="grid grid-cols-1 grid-rows-1 rounded-sm border border-[#aaaaa4e3] bg-[#e3e3dce3] px-2 py-1">
        <div className="col-start-1 row-start-1 w-full">
          {content.length === 0 ? (
            <>
              <p>⬆️ Fill the form above. This callout will autofill.</p>
              <p>Then, click on copy... ↘️</p>
              <p>
                ...and paste it in your HN account description. You can click on
                your username bellow to access your account in one click ⬇️
              </p>
            </>
          ) : (
            content.map((line) => <p key={line}>{line}</p>)
          )}
        </div>
        <CopyToClipboardBtn
          text={clipboardText}
          className="col-start-1 row-start-1 place-self-end self-end fill-black p-1"
        />
      </div>
      <p>
        Copy this text and paste it in the about section of your account:{" "}
        <ExternalLink
          href={`https://news.ycombinator.com/user?id=${state.username.length === 0 ? "dang" : state.username}`}
          className="font-medium"
        >
          {state.username.length === 0 ? "dang" : state.username}
        </ExternalLink>
        {state.username.length === 0 ? (
          <span className="inline italic">
            {" "}
            ⬅️ Placeholder username. Yours will be set here as soon as you fill
            it above.
          </span>
        ) : null}
      </p>
      <div className="flex items-center justify-between gap-3">
        {formState && Object.keys(formState).length > 0 && (
          <div className="text-sm text-red-800">{formState.message}</div>
        )}
        <SubmitButton
          disabled={state.isFormDisabled}
          className="ml-auto self-start bg-[#ff6602] hover:bg-[#e15b02]"
        />
      </div>
    </form>
  );
}

function SubmitButton({ className, ...props }: ButtonProps): JSX.Element {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className={className}
      disabled={pending || props.disabled}
      {...props}
    >
      <svg
        className={`-ml-1 mr-3 h-5 w-5 animate-spin text-white ${
          pending ? "" : "hidden"
        }`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      Add me on the map
    </Button>
  );
}
