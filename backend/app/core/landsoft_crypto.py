from __future__ import annotations

import base64
import math
import xml.etree.ElementTree as element_tree

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa


LANDSOFT_RSA_PRIVATE_KEY_XML = """
<RSAKeyValue><Modulus>rxZwQi8PwO9vGKVxGFTzuehApb0MpO92N/HOAMe0Ib7VkS6++gDtrFiotHWPzUjUklKa2hJjmG+6Sh74c+iwJpU7dQGRxvoXYuF+m9r4lyGzXTrRP4Wt16SmbF8Pm6jaw9JPu1Xy+8sVBxYq8B5jyI5aaZ7aKvSBuJGLMtv/wcE=</Modulus><Exponent>AQAB</Exponent><P>5nR8EplxlG0uPVGorn8OkMXZ9TF7BPa5wZs1vL4JPsxZv8D+UjufUsGrHOQmZRxvFe4J/1/iZI/6m+nHOcFk1w==</P><Q>wn7R12szMYoIMFN8UEXcEmamO7PSELqhV+qe9a/7N6G1pKG1xU3AZpkfW0E/GJZGl7pA9UQNQZTxS/LSv0AjJw==</Q><DP>inrSl4aXBp6422X3W6vDv+D0AO+Twb7Ujm9K0jjLa232PFCnQhjLuznfLcQ3Aikc42ufnFIsw0r1R70p1x3MDw==</DP><DQ>lYaKLOLtaJiF0yFb4RrUJhFkm2GTjejtQXnO23N/3zUjQH5SEG3GDRqLUMzIhU6C1wMKDYVT66dmGs2D2CSm4Q==</DQ><InverseQ>eXW6RmvwuAoo52IAnv9dBq+ixrZqhDKyFRYusjuUpFggPw7A4OknUNwJtCHeQecOCmKNTo0T+AmGfq530XnDqg==</InverseQ><D>RTclocRhAfClhqTAlNHgl/nMtLiLqxhPL8aTnZNVDpIWc5J7RPHhA2T5LH3dH1ZPUpj9RoBGhxiEGJEtvwSZvb76txmEXaUlou0ZZveeJe7O+crWT70dn06Qz+Ua7F6uwpVCQr7VmTEY4qXFowvrdH8Haz/2uHM+FFpv/1idD9E=</D></RSAKeyValue>
""".strip()


def _read_xml_value(root: element_tree.Element, name: str) -> int:
    value = root.findtext(name)
    if not value:
        raise ValueError(f"Missing RSA XML field: {name}")
    return int.from_bytes(base64.b64decode(value), "big")


def _private_key() -> rsa.RSAPrivateKey:
    root = element_tree.fromstring(LANDSOFT_RSA_PRIVATE_KEY_XML)
    public_numbers = rsa.RSAPublicNumbers(
        e=_read_xml_value(root, "Exponent"),
        n=_read_xml_value(root, "Modulus"),
    )
    private_numbers = rsa.RSAPrivateNumbers(
        p=_read_xml_value(root, "P"),
        q=_read_xml_value(root, "Q"),
        d=_read_xml_value(root, "D"),
        dmp1=_read_xml_value(root, "DP"),
        dmq1=_read_xml_value(root, "DQ"),
        iqmp=_read_xml_value(root, "InverseQ"),
        public_numbers=public_numbers,
    )
    return private_numbers.private_key()


_LANDSOFT_RSA_PRIVATE_KEY = _private_key()


def decrypt_landsoft_password(cipher_text: str) -> str:
    cipher_text = (cipher_text or "").strip()
    if not cipher_text:
        return ""

    key_size_bytes = math.ceil(_LANDSOFT_RSA_PRIVATE_KEY.key_size / 8)
    chunk_size = ((key_size_bytes + 2) // 3) * 4
    output = bytearray()

    for start in range(0, len(cipher_text), chunk_size):
        chunk = cipher_text[start : start + chunk_size]
        if len(chunk) < chunk_size:
            break
        cipher_bytes = bytearray(base64.b64decode(chunk))
        cipher_bytes.reverse()
        plain_bytes = _LANDSOFT_RSA_PRIVATE_KEY.decrypt(
            bytes(cipher_bytes),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA1()),
                algorithm=hashes.SHA1(),
                label=None,
            ),
        )
        output.extend(plain_bytes)

    return output.decode("utf-32")
