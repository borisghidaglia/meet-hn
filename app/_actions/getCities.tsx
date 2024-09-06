"use server";

import { getCities as _getCities } from "../_db/City";

export const getCities = async () => _getCities();
