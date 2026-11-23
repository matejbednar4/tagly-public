import type { Share } from "../../../generated/prisma/client.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import { getStoryInsights } from "../../../utils/instagram/mediaInsights/getStoryInsights.js";
import { getDecryptedInstagramTokenForCustomer } from "../../../utils/instagram/tokens/getDecryptedIgTokenForCustomer.js";

export async function executeInsightsJob(
  share: Pick<Share, "id" | "igPostId" | "igPostType" | "customerId">,
) {
  const { id: shareId, igPostId, igPostType, customerId } = share;

  // 8020–8022: igInsights permanent failures (worker 8xxx block).
  if (!customerId)
    throw createCustomError(8020, "Share is missing customerId", {
      permanent: true,
    });

  if (!igPostId)
    throw createCustomError(8021, "Share is missing igPostId", {
      permanent: true,
    });

  const { accessToken } =
    await getDecryptedInstagramTokenForCustomer(customerId);

  if (igPostType === "STORY") {
    await getStoryInsights({ shareId, igPostId, igAccessToken: accessToken });
  } else {
    throw createCustomError(8022, `Unsupported igPostType: ${igPostType}`, {
      permanent: true,
    });
  }

  return true;
}
