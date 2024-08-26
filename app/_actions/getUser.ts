"use server";

import { getUser as _getUser } from "../_db/User";

export const getUser = async (username: string) => _getUser(username);
