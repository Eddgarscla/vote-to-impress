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
};

export type PostCard = {
  id: string;
  imageUrl: string;
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
  levelKey: string;
  levelLabel: string;
  posts: ProfilePost[];
  placements: Placement[];
};

export type ChallengePhase = "upcoming" | "open" | "voting" | "ended";

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
};

export type EligiblePost = {
  id: string;
  imageUrl: string;
  caption: string;
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

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type Result<T = undefined> = T extends undefined
  ? Ok | Err
  : ({ ok: true } & T) | Err;
