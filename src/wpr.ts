import { MATCH_FETCH_LIMIT } from "./types";

const WPR_GRAPHQL = "https://api.redpadel.com/graphql";

async function gql(
  operationName: string,
  query: string,
  variables: object,
  token?: string,
): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(WPR_GRAPHQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ operationName, query, variables }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as any;
  if (json.errors) throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

export async function authenticateWPR(): Promise<string> {
  const email    = process.env.WPR_EMAIL;
  const password = process.env.WPR_PASSWORD;
  if (!email || !password)
    throw new Error("WPR_EMAIL and WPR_PASSWORD must be set in .env");

  const data = await gql(
    "Login",
    `mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        _id
        token
        refreshToken
      }
    }`,
    { email, password },
  );

  return data.login.token as string;
}

export async function searchPlayers(name: string, token: string): Promise<any[]> {
  const data = await gql(
    "Search",
    `query Search($searchInput: SearchInput!) {
      search(searchInput: $searchInput) {
        results {
          id
          title
          image
          type
          account
          rpr
          rprStatus
          rprConfidence
          rprS
          rprSStatus
          rprSConfidence
          socialRatingConfidenceLevel
          competitionRatingConfidenceLevel
        }
      }
    }`,
    { searchInput: { term: name, type: ["user"] } },
    token,
  );
  return data.search.results;
}

export async function getPlayer(id: string, token: string): Promise<any> {
  const data = await gql(
    "GetUser",
    `query GetUser($id: String!) {
      getUser(_id: $id) {
        _id
        firstName
        lastName
        photo
        createdAt
        rating {
          status
          value
          confidence
        }
        ratingVerified {
          status
          value
          confidence
        }
        hidden
        countryIsoCode
        playerId
        age
        gender
        socialRatingConfidenceLevel
        competitionRatingConfidenceLevel
      }
    }`,
    { id },
    token,
  );
  return data.getUser;
}

export async function getMatches(
  userId: string,
  token: string,
  limit = MATCH_FETCH_LIMIT,
): Promise<any[]> {
  const data = await gql(
    "GetMatches",
    `query GetMatches($filters: matchFilterInput, $pagination: PaginationInput, $sort: MatchSortInput) {
      getMatches(filters: $filters, pagination: $pagination, sort: $sort) {
        _id
        winner
        eventName
        category
        drawType
        round
        date
        status
        verified
        format
        users {
          _id
          team
          organizer
          ratingBefore {
            value
            confidence
          }
          ratingAfter {
            value
            confidence
          }
          data {
            _id
            firstName
            lastName
            ratingVerified {
              status
              value
              confidence
            }
            competitionRatingConfidenceLevel
            countryIsoCode
          }
        }
        sets {
          teamA
          teamB
        }
      }
    }`,
    {
      filters:    { userID: { condition: "EQUAL", value: userId } },
      pagination: { limit, skip: 0 },
      sort:       { sort: [{ field: "DATE", order: "DESC" }] },
    },
    token,
  );
  return data.getMatches;
}
