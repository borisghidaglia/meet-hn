"use server";

import { FormCity } from "@/app/_db/schema";
import { planSignUp } from "@/app/_db/signUpPlan";

// Dry run for the form: which page will this pick land on? Writes nothing.
export async function resolvePick(pickId: string): Promise<FormCity | null> {
  const plan = await planSignUp(pickId);
  if (!plan) return null;
  const { name, fullName, country, countryCode, hackers } = plan.city;
  return { id: plan.pageId, name, fullName, country, countryCode, hackers, pickId };
}
