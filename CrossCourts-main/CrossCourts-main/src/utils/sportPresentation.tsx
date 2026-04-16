import type { IconType } from "react-icons";
import {
  MdSportsBaseball,
  MdSportsBasketball,
  MdSportsCricket,
  MdSportsSoccer,
  MdSportsTennis,
  MdSportsVolleyball,
} from "react-icons/md";

export type SportPresentation = {
  label: string;
  Icon: IconType;
  accent: string;
};

type CourtLike = {
  sport_name?: string | null;
  sport_id?: number | null;
  cat_id?: number | null;
};

/**
 * Maps DB sport_id (arenas migration): 1 Cricket, 2 Soccer, 3 Padel, 4 Basketball.
 * Falls back to name keywords and legacy cat_id.
 */
export function getSportPresentation(court: CourtLike): SportPresentation {
  const sportName = (court.sport_name || "").toLowerCase();
  const sportId = court.sport_id ?? court.cat_id;

  if (sportName.includes("cricket") || sportId === 1) {
    return {
      label: "Cricket",
      Icon: MdSportsCricket,
      accent: "from-emerald-600 to-green-500",
    };
  }

  if (
    sportName.includes("football") ||
    sportName.includes("soccer") ||
    sportName.includes("futsal") ||
    sportId === 2
  ) {
    return {
      label: "Football / Soccer",
      Icon: MdSportsSoccer,
      accent: "from-sky-600 to-cyan-500",
    };
  }

  if (sportName.includes("padel") || sportName.includes("tennis") || sportId === 3) {
    return {
      label: "Padel / Tennis",
      Icon: MdSportsTennis,
      accent: "from-violet-600 to-fuchsia-500",
    };
  }

  if (sportName.includes("basketball") || sportId === 4) {
    return {
      label: "Basketball",
      Icon: MdSportsBasketball,
      accent: "from-orange-600 to-amber-500",
    };
  }

  if (sportName.includes("baseball")) {
    return {
      label: "Baseball",
      Icon: MdSportsBaseball,
      accent: "from-rose-700 to-orange-600",
    };
  }

  if (sportName.includes("volleyball") || sportName.includes("volley")) {
    return {
      label: "Volleyball",
      Icon: MdSportsVolleyball,
      accent: "from-indigo-600 to-blue-500",
    };
  }

  return {
    label: "Court",
    Icon: MdSportsTennis,
    accent: "from-slate-700 to-slate-500",
  };
}
