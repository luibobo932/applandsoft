import re
import unicodedata
from collections.abc import Iterable
from datetime import datetime
from urllib.parse import urlsplit

from app.schemas.properties import ListingAddressLookup, ListingAddressMatch

_STREET_PREFIX = r"^(?:duong\s+|d\.\s*)"
_SOURCE_HOSTS = {"chotot.com", "www.chotot.com", "nhatot.com", "www.nhatot.com"}
_LEGACY_SOURCE_LINE = re.compile(r"^[ \t]*Nguồn Chợ Tốt:[ \t]*(https?://\S+)[ \t]*\r?$", re.IGNORECASE | re.MULTILINE)


def source_listing_id_from_url(value: str | None) -> str | None:
    try:
        parsed = urlsplit((value or "").strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or parsed.netloc.casefold() not in _SOURCE_HOSTS:
        return None
    match = re.search(r"/([0-9]{1,12})\.htm/?$", parsed.path, flags=re.IGNORECASE)
    return match[1] if match else None


def _name_key(value: str | None, prefix: str) -> str:
    folded = unicodedata.normalize("NFD", (value or "").casefold().replace("đ", "d"))
    plain = "".join(char for char in folded if not unicodedata.combining(char))
    key = re.sub(prefix, "", " ".join(plain.split()))
    if key.isascii() and key.isdigit():
        return key.lstrip("0") or "0"
    return key


def _house_key(value: str | None) -> str:
    number = (value or "").replace("\u200b", "")
    number = re.sub(r"\s*([./-])\s*", r"\1", number)
    return " ".join(number.split()).casefold()


def _stored_source_id(row: dict) -> str | None:
    source_id = source_listing_id_from_url(row.get("source_url"))
    if source_id:
        return source_id
    # The Windows entry form appended the original link to the description.
    ids = {source_listing_id_from_url(link) for link in _LEGACY_SOURCE_LINE.findall(row.get("description") or "")}
    ids.discard(None)
    return next(iter(ids)) if len(ids) == 1 else None


def match_property_source_link(
    address: ListingAddressLookup, candidates: Iterable[dict]
) -> ListingAddressMatch:
    if not address.source_listing_id:
        return ListingAddressMatch()
    matches = [row for row in candidates if _stored_source_id(row) == address.source_listing_id]
    if len(matches) > 1:
        return ListingAddressMatch(ambiguous=True)
    if not matches:
        return ListingAddressMatch()

    row = matches[0]
    # Kiểm tra trường hợp link bị gắn nhầm vào hồ sơ có số nhà hoặc đường khác.
    house = _house_key(row.get("house_number"))
    street = _name_key(row.get("street"), _STREET_PREFIX)
    if (
        (address.house_number and house and house != _house_key(address.house_number))
        or (address.street and street and street != _name_key(address.street, _STREET_PREFIX))
    ):
        return ListingAddressMatch(ambiguous=True)
    result = _build_match(address, matches)
    result.matched_by_source_link = True
    return result


def match_property_address(
    address: ListingAddressLookup, candidates: Iterable[dict]
) -> ListingAddressMatch:
    district_prefix = r"^(?:(?:quan|huyen|thanh pho)\s+|(?:q|h|tp)\.\s*|q(?=[0-9]))"
    ward_prefix = r"^(?:(?:phuong|xa|thi tran)\s+|(?:p|x|tt)\.\s*|p(?=[0-9]))"
    house = _house_key(address.house_number)
    street = _name_key(address.street, _STREET_PREFIX)
    district = _name_key(address.district, district_prefix)
    ward = _name_key(address.ward, ward_prefix)
    aliases = {_name_key(name, ward_prefix) for name in address.ward_aliases} - {"", ward}
    if not house or not street or not district:
        return ListingAddressMatch()

    matches: list[dict] = []
    has_other_district = False
    for row in candidates:
        if _house_key(row.get("house_number")) != house:
            continue
        if _name_key(row.get("street"), _STREET_PREFIX) != street:
            continue
        if _name_key(row.get("district"), district_prefix) != district:
            has_other_district = True
            continue
        matches.append(row)

    if not matches and has_other_district:
        return ListingAddressMatch(ambiguous=True)

    if ward and matches:
        # Ưu tiên phường tra trực tiếp, sau đó mới dùng tên khác do tin cung cấp.
        exact = [row for row in matches if _name_key(row.get("ward"), ward_prefix) == ward]
        alternate = [row for row in matches if _name_key(row.get("ward"), ward_prefix) in aliases]
        if not exact and not alternate:
            return ListingAddressMatch(ambiguous=True)
        matches = exact or alternate

    wards = {_name_key(row.get("ward"), ward_prefix) for row in matches}
    if len(wards) > 1:
        return ListingAddressMatch(ambiguous=True)

    return _build_match(address, matches)


def _build_match(address: ListingAddressLookup, matches: list[dict]) -> ListingAddressMatch:
    phones: dict[str, str] = {}
    for row in matches:
        for value in (row.get("owner_phone"), row.get("owner_phone2")):
            phone = (value or "").strip()
            digits = re.sub(r"[^0-9]", "", phone)
            if 8 <= len(digits) <= 15 and re.fullmatch(r"\+?[0-9(). -]+", phone):
                key = "0" + digits[2:] if digits.startswith("84") else digits
                phones.setdefault(key, phone)
    result = ListingAddressMatch(match_count=len(matches), owner_phones=list(phones.values()))
    if address.include_record_times and matches:
        registered = [row["registered_at"] for row in matches if isinstance(row.get("registered_at"), datetime)]
        updated = [row["updated_at"] for row in matches if isinstance(row.get("updated_at"), datetime)]
        result.first_registered_at = min(registered, default=None)
        result.last_updated_at = max(updated, default=None)
        result.database_utc_offset_minutes = matches[0].get("database_utc_offset_minutes")
    return result
