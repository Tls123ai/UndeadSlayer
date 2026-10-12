import { forwardRef, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

// Small, hand-drawn bitmaps, not smoothed vector strokes or platform emoji.
const art = {
  sword: ["..........##", ".........###", "........###.", ".......###..", "......###...", ".....###....", "#...###.....", ".#.###......", "..###.......", "..###.......", ".#..#.......", "#....#......"],
  heart: [".###..###.", "##########", "##########", ".########.", "..######..", "...####...", "....##...."],
  shield: ["##########", "##..##..##", "##..##..##", "##..##..##", ".#..##..#.", ".#..##..#.", "..#.##.#..", "...####...", "....##...."],
  sparkles: [".....#......", ".....#...#..", "....###.###.", "..#######.#.", "....###.....", ".....#......", ".....#..#...", "..#....###..", ".###....#...", "..#........."],
  coins: ["..######....", ".##.##.##...", "##..##..##..", "##..##..####", ".##.##.##.##", "..######..##", "...##.##.##.", "....######.."],
  package: ["..######..", ".########.", "##..##..##", "##..##..##", "##########", "##......##", "##......##", "##########"],
  zap: [".....###..", "....###...", "...###....", "..#######.", ".#######..", "....###...", "...###....", "..###....."],
  play: ["##........", "####......", "######....", "########..", "########..", "######....", "####......", "##........"],
  pause: ["###..###", "###..###", "###..###", "###..###", "###..###", "###..###", "###..###", "###..###"],
  user: ["...####...", "..######..", "..######..", "...####...", "..........", "..######..", ".########.", "##########", "##########"],
  lock: ["..######..", ".##....##.", ".##....##.", ".##....##.", "##########", "####..####", "####..####", "####..####", "##########"],
  skull: ["..######..", ".########.", "##########", "##..##..##", "##..##..##", ".########.", "...####...", "..######..", "..#.#.#..."],
  crown: ["#....#....#", "##..###..##", "###.###.###", ".#########.", ".#########.", ".#..#.#..#.", ".#########.", ".#########."],
  database: ["..######..", ".########.", "##########", "##......##", "##########", "##......##", "##########", ".########.", "..######.."],
  hourglass: ["##########", ".##....##.", "..##..##..", "...####...", "....##....", "...####...", "..##..##..", ".########.", "##########"],
  check: [".........##", "........##.", ".......##..", "#.....##...", "##...##....", ".##.##.....", "..###......", "...#......."],
  plus: ["...##...", "...##...", "...##...", "########", "########", "...##...", "...##...", "...##..."],
  arrow: ["....##......", "...##.......", "..##........", ".###########", "############", ".###########", "..##........", "...##.......", "....##......"],
  chevron: ["....##....", "...####...", "..##..##..", ".##....##.", "##......##"],
  map: ["#####..#####", "##..####..##", "##...##...##", "##...##...##", "##...##...##", "##...##...##", "#####..#####"],
  pin: ["...####...", "..######..", ".########.", ".##....##.", ".##....##.", "..######..", "...####...", "....##....", "....##...."],
  compass: ["...######...", "..##....##..", ".##...#..##.", "##...###..##", "##..####..##", "##..####..##", "##..###...##", ".##..#...##.", "..##....##..", "...######..."],
  ghost: ["...####...", "..######..", ".########.", "##..##..##", "##..##..##", "##########", "##########", "##.####.##", "#...##...#"],
  settings: ["....####....", "..#.####.#..", ".##########.", "###..##..###", "####....####", "####....####", "###..##..###", ".##########.", "..#.####.#..", "....####...."],
  sliders: ["..##........", "..##........", "############", "..##........", "........##..", "........##..", "############", "........##.."],
  eye: ["...######...", "..##....##..", ".##..##..##.", "##..####..##", ".##..##..##.", "..##....##..", "...######..."],
  alert: [".....##.....", "....####....", "...######...", "..###..###..", "..###..###..", ".####..####.", ".##########.", "#####..#####", "############"],
  flame: [".....#.....", "....##.....", "....###....", "..#.####...", ".########..", ".###..###..", "####..####.", "###....###.", ".##....##..", "..######..."],
  door: ["##########", "##..######", "##..#...##", "##..#...##", "##..#.#.##", "##..#...##", "##..#...##", "##########"],
  trophy: ["############", "##.######.##", "##.######.##", ".###..###.#.", "...####.....", "....##......", "....##......", "..######....", "..######...."],
  wind: ["........###.", ".......#..##", "###########.", "............", "..##########", "..........##", "###########.", "............"],
  volume: [".....##.....", "....###..#..", "#######...#.", "#######.#..#", "#######.#..#", "#######...#.", "....###..#..", ".....##....."],
  bow: ["..##......", "..#.##....", "..#...##..", "..#.....#.", "##########", "..#.....#.", "..#...##..", "..#.##....", "..##......"],
  staff: ["....####..", "...######.", "...######.", "....####..", ".....##...", ".....##...", ".....##...", ".....##...", ".....##...", ".....##..."],
  axe: [".....##...", "..#####...", ".######...", "########..", ".######...", "..#####...", ".....##...", ".....##...", ".....##...", ".....##..."],
  potion: ["...####...", "....##....", "...####...", "..#....#..", ".#......#.", ".########.", ".########.", ".########.", "..######.."],
  leaf: [".......###", "....######", "..########", ".#####..##", "####...###", "###..####.", ".#..####..", "#........."],
  fist: ["...######.", "..########", "##########", "###.######", "###.######", ".########.", "..######..", "...####..."],
  circle: ["..######..", ".##....##.", "##......##", "##......##", "##......##", ".##....##.", "..######.."],
} as const;

function pathFor(bitmap: readonly string[]): string {
  const width = Math.max(...bitmap.map((row) => row.length));
  const ox = Math.floor((16 - width) / 2);
  const oy = Math.floor((16 - bitmap.length) / 2);
  return bitmap.flatMap((row, y) => Array.from(row, (cell, x) => cell === "#" ? `M${x + ox} ${y + oy}h1v1h-1z` : "")).join("");
}

function icon(name: string, bitmap: readonly string[]) {
  const path = pathFor(bitmap);
  const Component = forwardRef<SVGSVGElement, IconProps>(function PixelIcon({ size = 24, ...props }, ref) {
    return <svg ref={ref} width={size} height={size} viewBox="0 0 16 16" fill="currentColor" stroke="none" aria-hidden="true" shapeRendering="crispEdges" data-pixel-icon={name} {...props}><path d={path} /></svg>;
  });
  Component.displayName = `Pixel${name}`;
  return Component;
}

const crossed = art.sword.map((row) => [...row].map((cell, i) => cell === "#" || row[row.length - 1 - i] === "#" ? "#" : ".").join(""));
export const Sword = icon("sword", art.sword);
export const Swords = icon("swords", crossed);
export const Heart = icon("heart", art.heart);
export const Shield = icon("shield", art.shield);
export const ShieldAlert = icon("shield-alert", art.shield);
export const Sparkles = icon("sparkles", art.sparkles);
export const WandSparkles = icon("wand", art.staff);
export const Coins = icon("coins", art.coins);
export const Package = icon("package", art.package);
export const Zap = icon("zap", art.zap);
export const Play = icon("play", art.play);
export const Pause = icon("pause", art.pause);
export const User = icon("user", art.user);
export const UserRound = User;
export const Users = icon("users", art.user);
export const UserPlus = icon("user-plus", art.user);
export const Lock = icon("lock", art.lock);
export const Skull = icon("skull", art.skull);
export const Crown = icon("crown", art.crown);
export const Database = icon("database", art.database);
export const LoaderCircle = icon("hourglass", art.hourglass);
export const Check = icon("check", art.check);
export const CheckCircle2 = Check;
export const Plus = icon("plus", art.plus);
export const ArrowLeft = icon("arrow-left", art.arrow);
export const RotateCcw = icon("retry", art.arrow);
export const ChevronUp = icon("chevron-up", art.chevron);
export const Map = icon("map", art.map);
export const MapPin = icon("pin", art.pin);
export const Compass = icon("compass", art.compass);
export const Ghost = icon("ghost", art.ghost);
export const Settings = icon("settings", art.settings);
export const Sliders = icon("sliders", art.sliders);
export const Eye = icon("eye", art.eye);
export const EyeOff = icon("eye-off", art.eye.map((row, y) => [...row].map((cell, x) => x === y + 2 || x === y + 3 ? "#" : cell).join("")));
export const AlertTriangle = icon("alert", art.alert);
export const Flame = icon("flame", art.flame);
export const DoorOpen = icon("door", art.door);
export const Trophy = icon("trophy", art.trophy);
export const Award = Trophy;
export const Wind = icon("wind", art.wind);
export const Volume2 = icon("volume", art.volume);
export const LogIn = icon("sign-in", art.arrow.map((row) => [...row].reverse().join("")));
export const LogOut = icon("sign-out", art.door);

const glyphs: Record<string, ReturnType<typeof icon>> = {
  "🗡️": Sword, "⚔️": Swords, "🏹": icon("bow", art.bow), "🪓": icon("axe", art.axe),
  "🔮": icon("staff", art.staff), "🥷": Ghost, "🛡️": Shield, "🌿": icon("leaf", art.leaf),
  "👑": Crown, "🔥": Flame, "👊": icon("fist", art.fist), "🌀": Wind, "✨": Sparkles,
  "🩸": icon("potion", art.potion), "💥": Sparkles, "⚡": Zap, "🪨": Shield,
  "✝️": Plus, "🐉": Flame, "❤️": Heart, "👟": Wind, "🔋": Zap, "🎯": Eye,
  "☠️": Skull, "💀": Skull, "👻": Ghost, "🧪": icon("potion", art.potion),
};

/** Save data can retain its old emoji identifiers; rendering is always pixel art. */
export function PixelGlyph({ value, ...props }: IconProps & { value: string }) {
  const Component = glyphs[value] || Sparkles;
  return <Component className="pixel-glyph" {...props} />;
}

export const Circle = icon("circle", art.circle);
