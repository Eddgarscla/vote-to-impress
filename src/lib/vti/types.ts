/**
 * VOTE TO IMPRESS domain types.
 * Identity: Better Auth user id ↔ profiles.user_id.
 * Add future tables (notifications, saves, hashtags, blocks, badges)
 * in a new migration and new server functions — do not rebuild these.
 */

export type Author = {
  id: string;
  username: string;
  avatarUrl: string | null;
  verified?: boolean;
  isTest?: boolean;
};

export type PostCard = {
  id: string;
  imageUrl: string;
  images: string[];
  caption: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  challenge: { id: string; title: string } | null;
  author: Author;
};

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
};

export type ProfilePost = {
  id: string;
  imageUrl: string;
};

export type Placement = {
  challengeId: string;
  challengeTitle: string;
  place: number;
  points: number;
};

export type ProfilePayload = {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  email: string | null;
  isSelf: boolean;
  followedByMe: boolean;
  followers: number;
  following: number;
  postCount: number;
  impressPoints: number;
  challengeWins: number;
  topPlacements: number;
  role: "member" | "founder";
  verified: boolean;
  isTest: boolean;
  levelKey: string;
  levelLabel: string;
  nextAt: number | null;
  nextLabel: string | null;
  displayName: string;
  pronouns: string;
  location: string;
  website: string;
  instagram: string;
  tiktok: string;
  xHandle: string;
  robloxUsername: string;
  robloxUrl: string;
  showPersonal: boolean;
  gender: string;
  showGender: boolean;
  genderChoices: string[];
  posts: ProfilePost[];
  placements: Placement[];
};

export type ChallengePhase = "upcoming" | "open" | "voting" | "paused" | "ended";

export type ChallengeSummary = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  theme: string;
  startDate: string;
  endDate: string;
  submissionsClose: string;
  votingClose: string;
  phase: ChallengePhase;
  participants: number;
  pointsFirst: number;
  pointsSecond: number;
  pointsThird: number;
  voteBudget: number;
  isDemo: boolean;
  seasonId: string;
  kind: "daily" | "weekly" | "monthly";
  active: boolean;
};

export type RankedLook = {
  submissionId: string;
  postId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  imageUrl: string;
  caption: string;
  votes: number | null;
  votedByMe: boolean;
  place: number | null;
  points: number | null;
  pointsLabel: string;
  stageId: string;
};

export type EligiblePost = {
  id: string;
  imageUrl: string;
  caption: string;
};

export type VoteWallet = {
  balance: number;
  max: number;
  regen: number;
  nextInMs: number | null;
};

export type StageCard = {
  id: string;
  challengeId: string;
  title: string;
  description: string;
  requirement: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  open: boolean;
};

export type TwistCard = {
  id: string;
  challengeId: string;
  title: string;
  description: string;
  requirement: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  live: boolean;
};

export type RewardBand = {
  id: string;
  scope: string;
  placeFrom: number;
  placeTo: number;
  points: number;
};

export type VoteRules = {
  max: number;
  regen: number;
  intervalMinutes: number;
  allowMulti: boolean;
  expiry: boolean;
  bonus: boolean;
};

export type ChallengeDetail = ChallengeSummary & {
  ranking: RankedLook[];
  mySubmissionId: string | null;
  eligiblePosts: EligiblePost[];
  canSubmit: boolean;
  canVote: boolean;
  resultsPublic: boolean;
  votesUsed: number;
  votesLeft: number;
  wallet: VoteWallet;
  stages: StageCard[];
  twists: TwistCard[];
  openStageId: string;
};

export type SeasonPodium = {
  place: number;
  username: string;
  avatarUrl: string | null;
  points: number;
  weeklyWins: number;
};

export type SeasonCard = {
  id: string;
  title: string;
  tagline: string;
  themeKey: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
  podium: SeasonPodium[];
};

export type ChallengeBoard = {
  season: SeasonCard | null;
  challenges: ChallengeSummary[];
  role: "member" | "founder";
};

export type PersonCard = {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  followers: number;
  followedByMe: boolean;
};

export type ExploreLook = {
  id: string;
  imageUrl: string;
  username: string;
  likeCount: number;
};

export type WinnerCard = {
  postId: string;
  imageUrl: string;
  username: string;
  avatarUrl: string | null;
  challengeId: string;
  challengeTitle: string;
  points: number;
};

export type ExplorePayload = {
  recommended: PersonCard[];
  popular: ExploreLook[];
  newUsers: PersonCard[];
  trending: ExploreLook[];
  winners: WinnerCard[];
  lookbook: ExploreLook[];
};

export type LevelStep = { key: string; label: string; min: number };

export type FounderSubmission = {
  username: string;
  imageUrl: string;
  votes: number;
  place: number | null;
  points: number | null;
};

export type FounderChallengeRow = {
  id: string;
  title: string;
  description: string;
  theme: string;
  kind: "daily" | "weekly" | "monthly";
  phase: ChallengePhase;
  active: boolean;
  cancelled: boolean;
  startDate: string;
  endDate: string;
  participants: number;
  votes: number;
  voters: number;
  pointsFirst: number;
  pointsSecond: number;
  pointsThird: number;
  participationPoints: number;
  voteBudget: number;
  resultsPublic: boolean;
  ranking: { username: string; votes: number }[];
  submissions: FounderSubmission[];
  winner: string | null;
};

export type FounderRequest = {
  id: string;
  userId: string;
  username: string;
  message: string;
  status: string;
  followers: number;
  following: number;
  impressPoints: number;
  levelLabel: string;
  entries: number;
};

export type FounderPerson = {
  id: string;
  username: string;
  email: string | null;
  impressPoints: number;
  levelLabel: string;
  verified: boolean;
  isTest: boolean;
  role: "member" | "founder";
};

export type FounderDesk = {
  stats: {
    users: number;
    activeUsers: number;
    posts: number;
    followers: number;
    participation: number;
    votes: number;
    pending: number;
    points: number;
    winners: number;
  };
  themeKey: string;
  weeklyTheme: string;
  monthlyTheme: string;
  themeName: string;
  themeDescription: string;
  themeStarts: string;
  themeEnds: string;
  accentColor: string;
  levels: LevelStep[];
  challenges: FounderChallengeRow[];
  requests: FounderRequest[];
  people: FounderPerson[];
  testAccounts: { username: string; email: string; password: string }[];
  vote: VoteRules;
  bands: RewardBand[];
  stages: StageCard[];
  twists: TwistCard[];
  genders: { id: string; label: string; active: boolean }[];
};

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type Result<T = undefined> = T extends undefined
  ? Ok | Err
  : ({ ok: true } & T) | Err;
