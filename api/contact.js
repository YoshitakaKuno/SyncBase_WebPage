const FORM_ENDPOINT =
  "https://docs.google.com/forms/d/e/1FAIpQLSdZi1mJzA6XaVBI0rptGmgyiewkr2vk9DXU4O--QNRmCUYtSA/formResponse";
const VIEW_ENDPOINT =
  "https://docs.google.com/forms/d/e/1FAIpQLSdZi1mJzA6XaVBI0rptGmgyiewkr2vk9DXU4O--QNRmCUYtSA/viewform";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: VIEW_ENDPOINT,
  Origin: "https://docs.google.com",
};

const ENTRY_MAP = {
  company: "entry.2076927326",
  name: "entry.416174814",
  phone: "entry.1132384252",
  address: "entry.1114851624",
  email: "entry.2088062067",
  message: "entry.1665870488",
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(data || "{}"));
        } catch (err) {
          reject(err);
        }
        return;
      }
      const params = new URLSearchParams(data);
      const body = {};
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
      resolve(body);
    });
    req.on("error", reject);
  });
}

function buildGooglePayload(fields) {
  const payload = new URLSearchParams();
  Object.entries(ENTRY_MAP).forEach(([key, entry]) => {
    if (fields[key]) {
      payload.append(entry, fields[key]);
    }
  });
  return payload;
}

async function fetchFormToken() {
  const response = await fetch(VIEW_ENDPOINT, {
    headers: REQUEST_HEADERS,
  });
  const html = await response.text();
  const match = html.match(/name="fbzx" value="([^"]+)"/);
  return match ? match[1] : "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return;
  }

  try {
    const body = await parseBody(req);

    if (body.company_fax) {
      res.statusCode = 303;
      res.setHeader("Location", "/contact/thanks");
      res.end();
      return;
    }

    if (!body.name || !body.email || !body.message) {
      res.statusCode = 400;
      res.end("Required fields are missing.");
      return;
    }

    const payload = buildGooglePayload(body);
    const fbzx = await fetchFormToken();
    payload.append("fvv", "1");
    payload.append("fbzx", fbzx);
    payload.append("pageHistory", "0");
    payload.append("submissionTimestamp", "-1");
    payload.append("partialResponse", `[null,null,"${fbzx}"]`);

    const response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        ...REQUEST_HEADERS,
      },
      body: payload.toString(),
      redirect: "manual",
    });

    if (response.status >= 400) {
      res.statusCode = 502;
      res.end("Upstream form error.");
      return;
    }

    res.statusCode = 303;
    res.setHeader("Location", "/contact/thanks");
    res.end();
  } catch (error) {
    res.statusCode = 500;
    res.end("Server error.");
  }
};
