from app.repositories.sql_gateway import SqlLandsoftGateway


def test_parse_exact_address_with_alley_number() -> None:
    assert SqlLandsoftGateway._parse_exact_address_keyword("5A/1 Mai Hắc Đế") == (
        "5A/1",
        "Mai Hắc Đế",
    )


def test_parse_exact_address_accepts_comma_and_street_prefix() -> None:
    assert SqlLandsoftGateway._parse_exact_address_keyword("384/71, Đường Lý Thái Tổ") == (
        "384/71",
        "Lý Thái Tổ",
    )


def test_plain_house_number_keeps_general_search() -> None:
    assert SqlLandsoftGateway._parse_exact_address_keyword("5A/1") is None


def test_plain_text_keeps_general_search() -> None:
    assert SqlLandsoftGateway._parse_exact_address_keyword("Mai Hắc Đế") is None


def test_exact_address_builds_combined_house_and_street_filter() -> None:
    sql, params = SqlLandsoftGateway()._build_where_clause({"keyword": "5A/1 Mai Hắc Đế"})

    assert "bc.SoNha" in sql
    assert "s.Names" in sql
    assert " OR " not in sql
    assert params == ["5A/1", "%Mai Hắc Đế%"]
