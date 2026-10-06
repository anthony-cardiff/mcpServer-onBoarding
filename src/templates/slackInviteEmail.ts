/*
 * ============================================
 * SLACK INVITE EMAIL TEMPLATE
 * ============================================
 */

export interface SlackInviteEmailInput {
  firstName:
    string;

  cardiffEmail:
    string;

  slackWorkspaceUrl:
    string;
}


/*
 * ============================================
 * EMAIL SUBJECT
 * ============================================
 */

export function buildSlackInviteEmailSubject(
  input: SlackInviteEmailInput
): string {

  return `Your Cardiff Slack Access`;
}


/*
 * ============================================
 * PLAIN TEXT EMAIL
 * ============================================
 */

export function buildSlackInviteEmailText(
  input: SlackInviteEmailInput
): string {

  return `
Hi ${input.firstName},

Your Cardiff Slack account has been created.

You can access the Cardiff Slack workspace here:

${input.slackWorkspaceUrl}

When prompted for your username click the Google icon to sign in through Single Sign-On using your Cardiff Google account:

Thanks,

  `.trim();
}


/*
 * ============================================
 * HTML EMAIL
 * ============================================
 */

export function buildSlackInviteEmailHtml(
  input: SlackInviteEmailInput
): string {

  return `
<!DOCTYPE html>
<html>
  <body
    style="
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #222222;
    "
  >
    <p>
      Hi ${escapeHtml(input.firstName)},
    </p>

    <p>
      Your Cardiff Slack account has been created.
    </p>

    <p>
      You can access the Cardiff Slack workspace here:
    </p>

<table
  role="presentation"
  cellspacing="0"
  cellpadding="0"
  border="0"
>
  <tr>
    <td
      style="
        border-radius: 8px;
        background: #4A154B;
      "
    >
      <a
        href="${escapeHtml(input.slackWorkspaceUrl)}"
        style="
          display: inline-block;
          padding: 14px 22px;
          font-size: 18px;
          font-weight: bold;
          color: #ffffff;
          text-decoration: none;
          border-radius: 8px;
        "
      >
        Open Cardiff Slack
      </a>
    </td>
  </tr>
</table>

    <p>
     When prompted for your username click the Google icon to sign in through Single Sign-On using your Cardiff Google account.
    </p>

    <p>
      Thanks,
    </p>
  </body>
</html>
  `.trim();
}


/*
 * ============================================
 * HTML ESCAPING
 * ============================================
 */

function escapeHtml(
  value: string
): string {

  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}