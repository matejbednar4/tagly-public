import { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import { CONTACT } from "../../../constants/platform/CONTACT.js";
import { escapeHtml } from "../../../utils/formatting/escapeHtml.js";

/**
 * The exact shape every confirmation code is minted in —
 * `<prefix>_del_<instagram user id>_<epoch ms>` (`deleteInstagramData.ts:50`),
 * so everything after the prefix is digits.
 *
 * Whole-shape match, NOT a prefix check. This route is unauthenticated,
 * unrate-limited, and interpolates the code into an HTML response, so a prefix
 * check let arbitrary attacker-controlled text through into the page — a
 * reflected XSS on the API origin. Validating the entire string means nothing
 * but digits can ever reach the response.
 *
 * "flaer_del_" codes were minted before the Tagly rebrand in the identical
 * format (`origin/main:.../deleteInstagramData.ts:46`) and live in Meta-held
 * status URLs forever, so both prefixes stay accepted.
 */
const CONFIRMATION_CODE_PATTERN = /^(?:tagly|flaer)_del_\d+_\d+$/;

export const getInstagramDeletionStatus: RequestHandler = asyncHandler(
  async (req, res) => {
    // A repeated param (`?confirmation_code=a&confirmation_code=b`) arrives as
    // an array; calling a string method on it threw and 500-ed an
    // unauthenticated, unlimited route. Take the first value and type-guard.
    const rawCode = req.query.confirmation_code;
    const confirmationCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

    if (
      typeof confirmationCode !== "string" ||
      !CONFIRMATION_CODE_PATTERN.test(confirmationCode)
    ) {
      return res.status(400).send(
        `<!doctype html>
          <html>
            <head><title>Tagly - Instagram Data Deletion</title></head>
            <body>
              <h1>Instagram data deletion - invalid confirmation code</h1>
              <p>If you believe this is an error, please contact us at ${CONTACT.LEGAL_EMAIL}.</p>
            </body>
          </html>`
      );
    }

    return res.status(200).send(`<!doctype html>
      <html>
        <head><title>Tagly - Instagram Data Deletion</title></head>
        <body>
          <h1>Your Instagram data deletion request is complete</h1>
          <p>Any Instagram data we held for this account has been deleted or was never stored.</p>
          <p>Confirmation code: ${escapeHtml(confirmationCode)}</p>
          <p>If you have questions, contact us at <a href="mailto:${CONTACT.LEGAL_EMAIL}">${CONTACT.LEGAL_EMAIL}</a>.</p>
        </body>
      </html>`);
  }
);
