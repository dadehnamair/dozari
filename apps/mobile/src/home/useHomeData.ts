import { useCallback, useEffect, useState } from 'react';
import { provinceOf } from '@dozari/shared';
import type { DailyStatus, Gender, Province, ProfileTask } from '@dozari/shared';
import { fetchAgeTrack } from '../agetrack/api';
import { setLookGender, setLookTrack } from '../theme/look';
import { fetchDailyStatus } from '../daily/puzzleApi';
import { fetchMatchActive } from '../duel/api';
import { fetchWorn } from '../shop/api';
import { fetchGems } from '../ledger/gemsApi';
import { fetchMyProfile } from '../social/api';
import { fetchProfileTasks } from '../social/profileTasksApi';
import { fetchWheel } from '../wheel/api';
import type { ClientConfig } from '../config/gate';

/** What Home loads about the player: spins, a live match, profile bits, gems, mission tasks and today's daily puzzle. */
export function useHomeData(features: ClientConfig['features']) {
  const [spins, setSpins] = useState(0);
  const loadSpins = () => void fetchWheel().then((w) => setSpins(w.pending), () => undefined);
  useEffect(loadSpins, []);
  const [liveMatch, setLiveMatch] = useState(false);
  useEffect(() => {
    if (features.duel) void fetchMatchActive().then(setLiveMatch, () => undefined);
  }, [features.duel]);
  const [gender, setGender] = useState<Gender | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  /** The player's province (D101): its badge and local greeting sit under the wordmark. */
  const [province, setProvince] = useState<Province | null>(null);
  /** The city's own slogan (admin-written), shown under the greeting. */
  const [slogan, setSlogan] = useState<string | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyStatus | null>(null);
  useEffect(() => {
    void fetchAgeTrack().then((m) => setLookTrack(m.enabled ? m.track : null), () => undefined);
  }, []);
  const loadMe = useCallback(() => {
    fetchMyProfile().then((p) => (setGender(p.gender), setLookGender(p.gender), setLevel(p.level.level), setProvince(provinceOf(p.city?.province)), setSlogan(p.city?.sloganFa ?? null)), () => undefined);
  }, []);
  useEffect(loadMe, [loadMe]);
  /** What the hero wears (set in the fitting room). */
  const [worn, setWorn] = useState<{ slot: string; iconKey: string | null }[]>([]);
  const loadWorn = useCallback(() => void fetchWorn().then((r) => setWorn(r.worn), () => undefined), []);
  useEffect(loadWorn, [loadWorn]);
  const [profileTasks, setProfileTasks] = useState<ProfileTask[]>([]);
  const [gems, setGems] = useState(0);
  const loadGems = useCallback(() => void fetchGems().then((w) => setGems(w.balance), () => undefined), []);
  useEffect(loadGems, [loadGems]);
  const loadTasks = useCallback(() => void fetchProfileTasks().then((r) => setProfileTasks(r.tasks), () => undefined), []);
  useEffect(loadTasks, [loadTasks]);
  useEffect(() => {
    if (features.daily) fetchDailyStatus().then(setDailyPuzzle, () => undefined);
  }, [features.daily]);
  return { spins, loadSpins, liveMatch, gender, setGender, level, province, slogan, dailyPuzzle, loadMe, profileTasks, loadTasks, gems, worn, loadWorn };
}
