import pytest
from backend.app.services.standardiser import (
    CustomAliasEntry,
    get_merged_standard_curves,
    set_custom_aliases,
    standardise_mnemonic,
    validate_alias_for_curve,
)

@pytest.fixture(autouse=True)
def reset_aliases():
    set_custom_aliases([])
    yield
    set_custom_aliases([])

def test_matches_exact_standard_mnemonics():
    gr = standardise_mnemonic("GR", "GAPI")
    assert gr.standardMnemonic == "GR"
    assert gr.matchedName == "Gamma Ray"
    assert gr.confidence == 1.0
    assert gr.unitMismatch is False

    rhob = standardise_mnemonic("RHOB", "G/CC")
    assert rhob.standardMnemonic == "RHOB"
    assert rhob.confidence == 1.0
    assert rhob.unitMismatch is False

def test_identifies_vendor_aliases():
    gamma = standardise_mnemonic("GAMMA", "GAPI")
    assert gamma.standardMnemonic == "GR"
    assert gamma.matchedName == "Gamma Ray"
    assert gamma.confidence == 0.95

    den = standardise_mnemonic("DEN", "G/CC")
    assert den.standardMnemonic == "RHOB"
    assert den.confidence == 0.95

    cnl = standardise_mnemonic("CNL", "V/V")
    assert cnl.standardMnemonic == "NPHI"
    assert cnl.confidence == 0.95

    ild = standardise_mnemonic("ILD", "OHMM")
    assert ild.standardMnemonic == "RT"
    assert ild.confidence == 0.95

def test_detects_unit_mismatches():
    wrong_unit = standardise_mnemonic("GR", "DEGC")
    assert wrong_unit.standardMnemonic == "GR"
    assert wrong_unit.unitMismatch is True

    correct_unit = standardise_mnemonic("GR", "API")
    assert correct_unit.unitMismatch is False

def test_falls_back_cleanly_for_custom_mnemonics():
    custom = standardise_mnemonic("CUSTOM_TOOL_XYZ", "VOLTS")
    assert custom.standardMnemonic == "CUSTOM_TOOL_XYZ"
    assert "Custom Curve" in custom.matchedName
    assert custom.confidence == 0.0

def test_blocks_adding_another_standard_curve_mnemonic():
    validation = validate_alias_for_curve("RT", "CALI")
    assert validation.valid is False
    assert validation.error == "RT is already mapped to RT. Remove or choose a different alias."
    assert validation.mappedCurve == "RT"

def test_blocks_adding_builtin_alias_already_claimed():
    validation = validate_alias_for_curve("ILD", "CALI")
    assert validation.valid is False
    assert validation.error == "ILD is already mapped to RT. Remove or choose a different alias."
    assert validation.mappedCurve == "RT"

def test_blocks_adding_custom_alias_already_claimed():
    custom_entry = CustomAliasEntry(
        id="alias_1",
        alias="MY_GAMMA_TOOL",
        standardMnemonic="GR",
        addedBy="Alice",
        addedAt="2026-01-01T00:00:00Z",
    )
    set_custom_aliases([custom_entry])

    validation = validate_alias_for_curve("MY_GAMMA_TOOL", "RHOB")
    assert validation.valid is False
    assert validation.error == "MY_GAMMA_TOOL is already mapped to GR. Remove or choose a different alias."
    assert validation.mappedCurve == "GR"
