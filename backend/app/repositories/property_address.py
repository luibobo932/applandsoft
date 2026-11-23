import re
import unicodedata
from collections.abc import Iterable

from app.schemas.properties import ListingAddressLookup, ListingAddressMatch


def _name_key(value: str | None, prefix: str) -> str:
    folded = unicodedata.normalize("NFD", (value or "").casefold().replace("đ", "d"))
    plain = "".join(char for char in folded if not unicodedata.combining(char))
    key = re.sub(prefix, "", " ".join(plain.split()))
    if key.isascii() and key.isdigit():
        return key.lstrip("0") or "0"
    return key


def match_property_address(
    address: ListingAddressLookup, candidates: Iterable[dict]
) -> ListingAddressMatch:
    street_prefix = r"^(?:duong\s+|d\.\s*)"
    district_prefix = r"^(?:(?:quan|huyen|thanh pho)\s+|(?:q|h|tp)\.\s*|q(?=[0-9]))"
    ward_prefix = r"^(?:(?:phuong|xa|thi tran)\s+|(?:p|x|tt)\.\s*|p(?=[0-9]))"
    street = _name_key(address.street, street_prefix)
    district = _name_key(address.district, district_prefix)
    ward = _name_key(address.ward, ward_prefix)
    if not street or not district:
        return ListingAddressMatch()

    matches: list[dict] = []
    wards: set[str] = set()
    for row in candidates:
        stored_number = re.sub(r"\s*([./-])\s*", r"\1", row["house_number"])
        if " ".join(stored_number.split()).casefold() != address.house_number.casefold():
            continue
        if _name_key(row.get("street"), street_prefix) != street:
            continue
        if _name_key(row.get("district"), district_prefix) != district:
            continue
        row_ward = _name_key(row.get("ward"), ward_prefix)
        if ward and row_ward != ward:
            continue
        matches.append(row)
        wards.add(row_ward)

    if len(wards) > 1:
        return ListingAddressMatch(ambiguous=True)

    phones: dict[str, str] = {}
    for row in matches:
        for value in (row.get("owner_phone"), row.get("owner_phone2")):
            phone = (value or "").strip()
            digits = re.sub(r"[^0-9]", "", phone)
            if 8 <= len(digits) <= 15 and re.fullmatch(r"\+?[0-9(). -]+", phone):
                key = "0" + digits[2:] if digits.startswith("84") else digits
                phones.setdefault(key, phone)
    return ListingAddressMatch(match_count=len(matches), owner_phones=list(phones.values()))
