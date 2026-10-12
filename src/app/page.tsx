"use client";

import { PixelGlyph } from "@/components/game/PixelIcons";
import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import PixelScene from "@/components/game/PixelScene";
import ArtImage from "@/components/game/ArtImage";
import AuthModal from "@/components/auth/AuthModal";
import CharacterSelectModal from "@/components/game/CharacterSelectModal";
import ChapterMapModal from "@/components/game/ChapterMapModal";
import UpgradesModal from "@/components/game/UpgradesModal";
import InventoryModal from "@/components/game/InventoryModal";
import SettingsModal from "@/components/game/SettingsModal";
import LoadingScreen, { type LoadingStep } from "@/components/game/LoadingScreen";
import useGameProgress from "@/hooks/useGameProgress";
import { HEROES, type HeroDef, CHAPTERS, ENEMY_TYPES, type ChapterDef } from "@/lib/gameData";
import { sounds } from "@/lib/soundEffects";
import { preloadSpritesAsync } from "@/lib/spriteImages";
import { requestJson, errorMessage, finishLoading, LOADING_SCREEN_DURATIONS } from "@/lib/clientApi";
import type { GameSettings, PlayerUser, PlayerProgress, SessionResponse } from "@/lib/progress";
import {
  Play, Swords, Users, Compass, Sparkles, Package, Settings, Coins, Heart,
  Zap, Database, LoaderCircle, AlertTriangle, RotateCcw,
} from "@/components/game/PixelIcons";

const loadCombatEngine = () => import("@/components/game/CombatEngine");
const CombatEngine = dynamic(loadCombatEngine, {
  ssr: false,
  loading: () => <LoadingScreen title="Preparing the battlefield" message="Starting the battle engine…" />,
});

interface StartupState {
  phase: "database" | "assets" | "ready";
  progress?: number;
  message: string;
  error: string | null;
}
const INITIAL_STARTUP: StartupState = {
  phase: "database", message: "Connecting to the save database…", error: null,
};
interface BattleLoadingState {
  progress: number;
  bundleReady: boolean;
  assetsReady: boolean;
  error: string | null;
}
interface BattleResult {
  victory: boolean;
  rewardCoins: number;
  rewardXp: number;
  potionsUsed: number;
  bossDefeated?: boolean;
  dropItem?: ChapterDef["completionReward"]["item"];
}

export default function GameRootPage() {
  const [authState, setAuthState] = useState<{
    loaded: boolean;
    authenticated: boolean;
    user: PlayerUser | null;
  }>({ loaded: false, authenticated: false, user: null });
  const { progress, saveStatus, saveProgress, setSessionProgress, retrySave, flushSaves } = useGameProgress();
  const [startup, setStartup] = useState<StartupState>(INITIAL_STARTUP);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [currentMode, setCurrentMode] = useState<"menu" | "loading-combat" | "combat">("menu");
  const [combatStage, setCombatStage] = useState<{ chapterId: number; levelNumber: number } | null>(null);
  const [battleLoading, setBattleLoading] = useState<BattleLoadingState>({ progress: 0, bundleReady: false, assetsReady: false, error: null });
  const combatController = useRef<AbortController | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showReauthenticate, setShowReauthenticate] = useState(false);

  const [showHeroesModal, setShowHeroesModal] = useState(false);
  const [showChaptersModal, setShowChaptersModal] = useState(false);
  const [showUpgradesModal, setShowUpgradesModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function checkSession() {
      const startedAt = performance.now();
      try {
        const data = await requestJson<SessionResponse>("/api/auth/me", { signal: controller.signal });
        if (data.authenticated && (!data.user || !data.progress)) throw new Error("Your saved adventure could not be restored. Please try again.");
        if (!active) return;
        setStartup({ phase: "assets", progress: 70, message: "Loading heroes and realm artwork…", error: null });
        await preloadSpritesAsync([
          ...Object.values(HEROES).map((hero) => hero.image),
          ...CHAPTERS.map((chapter) => chapter.boss.image),
        ], (completed, total) => {
          if (active) setStartup((previous) => ({ ...previous, progress: 70 + 30 * completed / Math.max(1, total) }));
        }, controller.signal);
        if (!active) return;
        setStartup({ phase: "ready", progress: 100, message: "The realm is ready. Your journey awaits.", error: null });
        await finishLoading(startedAt, LOADING_SCREEN_DURATIONS.startup, controller.signal);
        if (!active) return;
        setSessionProgress(data.authenticated ? data.progress! : null);
        setAuthState({ loaded: true, authenticated: data.authenticated, user: data.user || null });
      } catch (error) {
        if (active) setStartup((previous) => ({ ...previous, error: errorMessage(error, "The realm could not be loaded. Please try again.") }));
      }
    }
    void checkSession();
    return () => { active = false; controller.abort(); };
  }, [startupAttempt, setSessionProgress]);

  useEffect(() => () => combatController.current?.abort(), []);

  const handleAuthSuccess = (user: PlayerUser, userProgress: PlayerProgress) => {
    setAuthState({ loaded: true, authenticated: true, user });
    setSessionProgress(userProgress);
    setCurrentMode("menu");
    setActionError(null);
  };

  const handleLogout = async () => {
    sounds.playClick();
    // Do not discard unsaved edits just because the player clicked sign out.
    if (!(await flushSaves())) { setShowSettingsModal(false); return; }
    try {
      await requestJson("/api/auth/logout", { method: "POST" });
      setAuthState({ loaded: true, authenticated: false, user: null });
      setSessionProgress(null);
      setCurrentMode("menu");
      setShowSettingsModal(false);
      setActionError(null);
    } catch (error) {
      setShowSettingsModal(false);
      setActionError(errorMessage(error, "Could not sign out. Please try again."));
    }
  };

  // Load the engine and decode stage artwork BEFORE the simulation starts.
  const handleStartLevel = async (chapterId: number, levelNumber: number) => {
    if (!progress) return;
    combatController.current?.abort();
    const controller = new AbortController();
    combatController.current = controller;
    const startedAt = performance.now();
    const chapter = CHAPTERS.find((item) => item.id === chapterId) || CHAPTERS[0];
    const level = chapter.levels.find((item) => item.levelNumber === levelNumber) || chapter.levels[0];
    setShowChaptersModal(false);
    setCombatStage({ chapterId, levelNumber });
    setBattleLoading({ progress: 0, bundleReady: false, assetsReady: false, error: null });
    setCurrentMode("loading-combat");
    let bundleReady = false;
    let artworkProgress = 0;
    const report = () => {
      if (!controller.signal.aborted) setBattleLoading((previous) => ({
        ...previous,
        progress: (bundleReady ? 25 : 0) + 75 * artworkProgress,
        bundleReady,
        assetsReady: artworkProgress === 1,
      }));
    };
    try {
      await Promise.all([
        loadCombatEngine().then(() => { bundleReady = true; report(); }),
        preloadSpritesAsync([
          (HEROES[progress.selectedHeroId] || HEROES.aiden).image,
          chapter.boss.image,
          ...level.enemyTypes.map((key) => ENEMY_TYPES[key]?.image),
          ...level.eliteTypes.map((key) => ENEMY_TYPES[key]?.image),
        ], (completed, total) => { artworkProgress = total ? completed / total : 1; report(); }, controller.signal),
      ]);
      await finishLoading(startedAt, LOADING_SCREEN_DURATIONS.battle, controller.signal);
      if (!controller.signal.aborted) setCurrentMode("combat");
    } catch (error) {
      if (!controller.signal.aborted) setBattleLoading((previous) => ({ ...previous, error: errorMessage(error, "The battlefield could not be loaded.") }));
    }
  };

  const handleContinueAdventure = () => {
    sounds.playClick();
    void handleStartLevel(progress?.highestChapterUnlocked || 1, progress?.highestLevelUnlocked || 1);
  };

  const handleBattleEnd = async (result: BattleResult) => {
    if (!combatStage) { setCurrentMode("menu"); return; }
    await saveProgress((previous) => {
      const stageKey = `${combatStage.chapterId}-${combatStage.levelNumber}`;
      const completed = new Set(previous.completedLevels);
      let highestChapterUnlocked = previous.highestChapterUnlocked;
      let highestLevelUnlocked = previous.highestLevelUnlocked;
      if (result.victory) {
        completed.add(stageKey);
        // Replaying an earlier stage must not move the current chapter frontier.
        if (combatStage.chapterId === highestChapterUnlocked && combatStage.levelNumber === highestLevelUnlocked) {
          if (combatStage.levelNumber < 5) highestLevelUnlocked += 1;
          else if (result.bossDefeated && combatStage.chapterId < 5) { highestChapterUnlocked += 1; highestLevelUnlocked = 1; }
        }
      }
      const inventory = [...previous.inventory];
      const item = result.dropItem;
      if (item && !inventory.some((owned) => owned.itemId === item.id)) {
        inventory.push({
          id: `item_${Date.now()}`, itemId: item.id, name: item.name, type: item.type, rarity: item.rarity,
          atkBonus: item.atk, hpBonus: item.hp, defBonus: item.def, critBonus: item.crit, equipped: false,
          description: `Trophy won from defeating Chapter ${combatStage.chapterId} Boss.`,
        });
      }
      const xp = previous.xp + result.rewardXp;
      return {
        ...previous,
        coins: previous.coins + result.rewardCoins,
        xp,
        level: 1 + Math.floor(xp / 500),
        healthPotions: Math.max(0, previous.healthPotions - result.potionsUsed),
        completedLevels: Array.from(completed),
        highestChapterUnlocked, highestLevelUnlocked, inventory,
      };
    });
    setCurrentMode("menu");
  };

  const handleSelectHero = (heroId: string) => saveProgress((previous) => ({ ...previous, selectedHeroId: heroId }));
  const handleUnlockHero = (heroId: string, cost: number) => saveProgress((previous) => {
    if (previous.unlockedHeroes.includes(heroId) || previous.coins < cost) return previous;
    return { ...previous, coins: previous.coins - cost, unlockedHeroes: [...previous.unlockedHeroes, heroId], selectedHeroId: heroId };
  });
  const handleUpgradeStat = (statKey: "attackLevel" | "healthLevel" | "defenseLevel" | "skillLevel", cost: number) => saveProgress((previous) => {
    if (previous.coins < cost) return previous;
    return { ...previous, coins: previous.coins - cost, statUpgrades: { ...previous.statUpgrades, [statKey]: previous.statUpgrades[statKey] + 1 } };
  });
  const handleEquipItem = (itemId: string, type: string) => saveProgress((previous) => ({
    ...previous,
    inventory: previous.inventory.map((item) => item.type === type ? { ...item, equipped: item.id === itemId ? !item.equipped : false } : item),
  }));
  const handleBuyPotion = (cost: number) => saveProgress((previous) => previous.coins < cost ? previous : {
    ...previous, coins: previous.coins - cost, healthPotions: previous.healthPotions + 1,
  });
  const handleUpdateSettings = (settings: GameSettings) => saveProgress((previous) => ({ ...previous, settings }));

  const getEquippedStats = () => (progress?.inventory || []).reduce((stats, item) => item.equipped ? {
    atk: stats.atk + item.atkBonus, hp: stats.hp + item.hpBonus,
    def: stats.def + item.defBonus, crit: stats.crit + item.critBonus,
  } : stats, { atk: 0, hp: 0, def: 0, crit: 0 });

  if (!authState.loaded) {
    const steps: LoadingStep[] = [
      { label: "Save database", state: startup.phase === "database" ? "active" : "complete" },
      { label: "Your journey", state: startup.phase === "database" ? "pending" : "complete" },
      { label: "Realm artwork", state: startup.phase === "ready" ? "complete" : startup.phase === "assets" ? "active" : "pending" },
    ];
    return <LoadingScreen progress={startup.progress} message={startup.message} steps={steps} error={startup.error}
      onRetry={() => { setStartup(INITIAL_STARTUP); setStartupAttempt((attempt) => attempt + 1); }} />;
  }

  if (!authState.authenticated || !progress) return <AuthModal onSuccess={handleAuthSuccess} />;

  if (showReauthenticate) return <AuthModal initialUsername={authState.user?.username} onCancel={() => setShowReauthenticate(false)} onSuccess={(user) => {
    if (user.id !== authState.user?.id) throw new Error("Please sign in to the same account to keep your unsaved progress.");
    setAuthState({ loaded: true, authenticated: true, user });
    setShowReauthenticate(false);
    void retrySave();
  }} />;

  if (currentMode === "loading-combat" && combatStage) {
    const chapter = CHAPTERS.find((item) => item.id === combatStage.chapterId) || CHAPTERS[0];
    const level = chapter.levels.find((item) => item.levelNumber === combatStage.levelNumber) || chapter.levels[0];
    return <LoadingScreen title={`Entering ${level.title}`} progress={battleLoading.progress}
      message={battleLoading.progress === 100 ? "Your hero is ready. Opening the battlefield…" : "Preparing the battle engine and stage artwork…"}
      steps={[
        { label: "Battle engine", state: battleLoading.bundleReady ? "complete" : "active" },
        { label: "Stage artwork", state: battleLoading.assetsReady ? "complete" : "active" },
      ]} error={battleLoading.error}
      tip={`${chapter.subtitle}: ${chapter.description}`}
      onRetry={() => void handleStartLevel(combatStage.chapterId, combatStage.levelNumber)}
      onCancel={() => { combatController.current?.abort(); setCurrentMode("menu"); }} />;
  }

  if (currentMode === "combat" && combatStage) return <CombatEngine
    heroId={progress.selectedHeroId || "aiden"} chapterId={combatStage.chapterId} levelNumber={combatStage.levelNumber}
    statUpgrades={progress.statUpgrades} equippedStats={getEquippedStats()} healthPotions={progress.healthPotions}
    settings={progress.settings} onBattleEnd={handleBattleEnd} onExit={() => setCurrentMode("menu")} />;

  // Active Hero Definition
  const activeHero: HeroDef = HEROES[progress.selectedHeroId] || HEROES.aiden;
  const currentChapter = CHAPTERS.find((c) => c.id === progress.highestChapterUnlocked) || CHAPTERS[0];

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-white font-sans relative overflow-x-hidden flex flex-col">
      <PixelScene />

      {/* Main RPG Navigation Bar */}
      <header className="relative z-20 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center text-xl shadow-lg border border-amber-400/40">
            <Swords size={26} />
          </div>
          <div>
            <div className="game-brand text-base sm:text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-300 to-purple-400 uppercase">
              UNDEAD SLAYER
            </div>
            <div className="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
              Action RPG Chronicles · 10 Classes · 5 Chapters
            </div>
          </div>
        </div>

        {/* Currency & Player Summary Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div role="status" aria-live="polite" data-testid="save-status"
            title={saveStatus.state === "saving" ? "Saving progress to the database" : saveStatus.state === "error" ? "Progress has not been saved" : "Progress saved to the database"}
            className={`flex items-center gap-1.5 text-[10px] ${saveStatus.state === "error" ? "text-amber-400" : saveStatus.state === "saving" ? "text-neutral-400" : "text-emerald-400"}`}>
            {saveStatus.state === "saving" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : saveStatus.state === "error" ? <AlertTriangle className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{saveStatus.state === "saving" ? "Saving…" : saveStatus.state === "error" ? "Unsaved changes" : "Progress saved"}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-red-400 text-xs font-bold font-mono">
            <Heart className="w-4 h-4 fill-current" />
            <span>x{progress.healthPotions}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-amber-400 text-xs font-bold font-mono">
            <Coins className="w-4 h-4" />
            <span>{progress.coins.toLocaleString()}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-neutral-300">{authState.user?.username}</span>
            <span className="bg-amber-950 text-amber-400 border border-amber-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
              Lv.{progress.level}
            </span>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              setShowSettingsModal(true);
            }}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 hover:text-white transition"
            title="Settings & Profile"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {(saveStatus.state === "error" || actionError) && (
        <div role="alert" className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-xl rounded-2xl border border-amber-700/60 bg-neutral-900 p-4 shadow-2xl flex flex-wrap items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-bold text-amber-300">{saveStatus.state === "error" ? "Progress not saved" : "Request could not be completed"}</p>
            <p className="mt-1 text-neutral-300">{saveStatus.state === "error" ? saveStatus.message : actionError}</p>
            {saveStatus.state === "error" && <p className="mt-1 text-neutral-400">Keep this page open until your save succeeds.</p>}
          </div>
          {saveStatus.state === "error" ? (
            <button type="button" onClick={() => saveStatus.needsAuth ? setShowReauthenticate(true) : void retrySave()}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20">
              <RotateCcw className="w-3.5 h-3.5" /> {saveStatus.needsAuth ? "Sign in to save" : "Retry save"}
            </button>
          ) : <button type="button" onClick={() => setActionError(null)} className="text-xs text-neutral-400 hover:text-white">Dismiss</button>}
        </div>
      )}

      {/* Main Sanctuary Dashboard */}
      <main className="flex-1 relative z-10 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-between gap-8">
        {/* Top Hero & Campaign Status Spotlight */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Active Champion Spotlight Card */}
          <div
            className="pixel-panel lg:col-span-7 rounded-3xl border p-5 sm:p-7 relative overflow-hidden shadow-2xl flex flex-col sm:flex-row items-center gap-6"
            style={{
              borderColor: `${activeHero.accentColor}55`,
              background: `linear-gradient(135deg, ${activeHero.color}22 0%, rgba(10,10,15,0.95) 70%)`,
            }}
          >
            {/* Vanguard Avatar Display */}
            <div className="relative group shrink-0">
              <div
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-2 shadow-2xl transition-transform duration-300 group-hover:scale-105"
                style={{ borderColor: activeHero.accentColor, backgroundColor: activeHero.color, boxShadow: `0 24px 60px -24px ${activeHero.color}` }}
              >
                <ArtImage src={activeHero.image} fallbackText={activeHero.classIcon} alt={activeHero.name} className="w-full h-full object-cover object-top" />
              </div>
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-neutral-950 border border-amber-500/60 text-amber-400 text-[9px] font-bold uppercase whitespace-nowrap shadow">
                Vanguard
              </div>
            </div>

            {/* Vanguard Details */}
            <div className="flex-1 text-center sm:text-left w-full">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="text-2xl sm:text-3xl font-black text-white">{activeHero.name}</span>
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide"
                  style={{ backgroundColor: `${activeHero.color}25`, color: activeHero.accentColor, borderColor: activeHero.accentColor }}
                >
                  <PixelGlyph value={activeHero.classIcon} size={16} /> {activeHero.classType}
                </span>
              </div>

              <div className="text-[11px] text-amber-300 font-semibold mb-1">{activeHero.title}</div>
              <div className="text-[11px] text-neutral-400 mb-3 leading-relaxed">{activeHero.lore}</div>

              {/* Combat Stats Badges */}
              <div className="grid grid-cols-3 gap-2.5 max-w-sm mb-4">
                {[
                  { label: "Health", value: Math.round(activeHero.stats.hp * (1 + (progress.statUpgrades.healthLevel - 1) * 0.18)), suffix: "HP", color: "text-emerald-400" },
                  { label: "Attack", value: Math.round(activeHero.stats.atk * (1 + (progress.statUpgrades.attackLevel - 1) * 0.15)), suffix: "ATK", color: "text-rose-400" },
                  { label: "Defense", value: Math.round(activeHero.stats.def * (1 + (progress.statUpgrades.defenseLevel - 1) * 0.12)), suffix: "DEF", color: "text-blue-400" },
                ].map((st) => (
                  <div key={st.label} className="bg-black/40 border border-white/10 rounded-xl p-2 text-center">
                    <div className="text-[10px] text-neutral-400 uppercase font-semibold">{st.label}</div>
                    <div className={`text-xs font-mono font-bold ${st.color}`}>{st.value} {st.suffix}</div>
                  </div>
                ))}
              </div>

              {/* Special Skill Banner */}
              <div className="flex items-center gap-2.5 bg-purple-950/30 border border-purple-700/40 px-3 py-2 rounded-xl text-xs">
                <PixelGlyph value={activeHero.skill.icon} size={24} />
                <span className="font-bold text-purple-200">{activeHero.skill.name}:</span>
                <span className="text-neutral-400 truncate max-w-xs">{activeHero.skill.description}</span>
              </div>
            </div>
          </div>

          {/* Current Campaign Progress Banner */}
          <div className="pixel-panel lg:col-span-5 bg-white/[0.04] border border-white/10 rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4" /> Current Expedition
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  {progress.completedLevels?.length || 0} / 25 Stages Cleared
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">{currentChapter.title}: {currentChapter.subtitle}</h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{currentChapter.description}</p>

              {/* Chapter boss preview */}
              <div className="mt-3.5 flex items-center gap-3 rounded-2xl border border-red-800/50 bg-red-950/25 p-2.5">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-red-700/60 bg-black/40 shrink-0 shadow-lg">
                  <ArtImage src={currentChapter.boss.image} fallbackText="☠️" alt={currentChapter.boss.name} className="w-full h-full object-cover object-top" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-red-400 uppercase font-bold tracking-wide">Chapter Boss</div>
                  <div className="text-xs text-white font-bold truncate">{currentChapter.boss.name}</div>
                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    HP {currentChapter.boss.hp.toLocaleString()} · ATK {currentChapter.boss.atk}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-5 space-y-2.5 relative">
              <button
                onClick={handleContinueAdventure}
                className="btn-3d w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" /> Continue Adventure
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowChaptersModal(true);
                }}
                className="btn-3d w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
              >
                <Compass className="w-4 h-4" /> Explore World Map · 5 Chapters
              </button>
            </div>
          </div>
        </div>

        {/* Action RPG Command Menu Hub */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> Sanctuary Pavilions
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                key: "heroes",
                icon: Users,
                tint: "text-blue-300",
                bg: "#101c33",
                border: "#2f5fbf",
                title: "Class Select",
                sub: `${progress.unlockedHeroes?.length || 1} / 10 Recruited`,
                onClick: () => setShowHeroesModal(true),
              },
              {
                key: "chapters",
                icon: Swords,
                tint: "text-red-300",
                bg: "#2a0f0f",
                border: "#b91c1c",
                title: "World Map",
                sub: "5 Chapters · 25 Stages · 5 Bosses",
                onClick: () => setShowChaptersModal(true),
              },
              {
                key: "upgrades",
                icon: Zap,
                tint: "text-amber-300",
                bg: "#2b2107",
                border: "#ca8a04",
                title: "Stat Training",
                sub: "ATK · HP · DEF · SKILL",
                onClick: () => setShowUpgradesModal(true),
              },
              {
                key: "inventory",
                icon: Package,
                tint: "text-cyan-300",
                bg: "#082430",
                border: "#0e7490",
                title: "Armory",
                sub: `${progress.inventory?.length || 0} Items · Potions`,
                onClick: () => setShowInventoryModal(true),
              },
            ].map((tile) => {
              const Icon = tile.icon;
              return (
                <button
                  key={tile.key}
                  onClick={() => {
                    sounds.playClick();
                    tile.onClick();
                  }}
                  className="btn-3d p-4 sm:p-5 rounded-2xl text-left flex flex-col gap-3 bg-white/[0.04] border border-white/10 hover:border-amber-500/70 hover:bg-white/[0.07] transition group"
                >
                  <div
                    className="w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner transition-transform group-hover:scale-110"
                    style={{ backgroundColor: tile.bg, borderColor: tile.border }}
                  >
                    <Icon className={`w-6 h-6 ${tile.tint}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">{tile.title}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{tile.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showHeroesModal && (
        <CharacterSelectModal
          selectedHeroId={progress.selectedHeroId || "aiden"}
          unlockedHeroes={progress.unlockedHeroes || ["aiden"]}
          heroLevels={progress.heroLevels || {}}
          playerCoins={progress.coins || 0}
          onSelectHero={handleSelectHero}
          onUnlockHero={handleUnlockHero}
          onClose={() => setShowHeroesModal(false)}
        />
      )}

      {showChaptersModal && (
        <ChapterMapModal
          highestChapterUnlocked={progress.highestChapterUnlocked || 1}
          highestLevelUnlocked={progress.highestLevelUnlocked || 1}
          completedLevels={progress.completedLevels || []}
          onStartLevel={handleStartLevel}
          onClose={() => setShowChaptersModal(false)}
        />
      )}

      {showUpgradesModal && (
        <UpgradesModal
          coins={progress.coins || 0}
          statUpgrades={progress.statUpgrades}
          onUpgradeStat={handleUpgradeStat}
          onClose={() => setShowUpgradesModal(false)}
        />
      )}

      {showInventoryModal && (
        <InventoryModal
          inventory={progress.inventory || []}
          coins={progress.coins || 0}
          healthPotions={progress.healthPotions || 0}
          onEquipItem={handleEquipItem}
          onBuyPotion={handleBuyPotion}
          onClose={() => setShowInventoryModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={progress.settings}
          username={authState.user?.username || "Slayer"}
          level={progress.level}
          xp={progress.xp}
          coins={progress.coins}
          unlockedCount={progress.unlockedHeroes?.length || 1}
          completedCount={progress.completedLevels?.length || 0}
          onUpdateSettings={handleUpdateSettings}
          onLogout={handleLogout}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
