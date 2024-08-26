"use server";

import { getCity as _getCity } from "../_db/City";

export const getCity = async (cityId: string) => _getCity(cityId);
