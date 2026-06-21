FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# SQL Server Landsoft cu dung chu ky TLS bi OpenSSL 3 chan o security level mac dinh.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg2 ca-certificates unixodbc-dev \
    && curl -fsSLo /tmp/packages-microsoft-prod.deb \
        https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && rm /tmp/packages-microsoft-prod.deb \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && cp /etc/ssl/openssl.cnf /etc/ssl/openssl-landsoft.cnf \
    && printf '\n[openssl_init]\nssl_conf = ssl_sect\n\n[ssl_sect]\nsystem_default = system_default_sect\n\n[system_default_sect]\nMinProtocol = TLSv1\nCipherString = DEFAULT@SECLEVEL=0\nOptions = UnsafeLegacyRenegotiation\n' \
        >> /etc/ssl/openssl-landsoft.cnf \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV OPENSSL_CONF=/etc/ssl/openssl-landsoft.cnf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
