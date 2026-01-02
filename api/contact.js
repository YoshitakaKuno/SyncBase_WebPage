const GAS_ENDPOINT = process.env.GAS_ENDPOINT || "";

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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return;
  }

  try {
    if (!GAS_ENDPOINT) {
      res.statusCode = 500;
      res.end("GAS endpoint is not configured.");
      return;
    }

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

    const response = await fetch(GAS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: payload.toString(),
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
