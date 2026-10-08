import { useLiveQuery } from "dexie-react-hooks";
import { readData } from "./database";
export const useData = () => useLiveQuery(readData, []);
