"""Auth, staff, roles, customers and addresses."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core import permissions as perms
from app.schemas.common import ApiModel


# --- Admin auth -------------------------------------------------------------


class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class RoleSummary(ApiModel):
    id: int
    slug: str
    name: str


class AdminMe(ApiModel):
    id: int
    name: str
    email: str
    phone: str | None
    role: RoleSummary
    # Resolved, wildcard already expanded. The dashboard hides what it
    # cannot use, so it must see the same list the API enforces rather than
    # a role name it would have to interpret itself.
    permissions: list[str]
    is_super_admin: bool
    must_change_password: bool
    last_login_at: datetime | None


class AdminLoginResponse(ApiModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AdminMe


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=10, max_length=200)

    @field_validator("new_password")
    @classmethod
    def _strong_enough(cls, value: str) -> str:
        # Length carries most of the strength; the class checks catch the
        # "Password123" shape that length alone would wave through.
        if value.isalpha() or value.isdigit():
            raise ValueError("Use a mix of letters, digits and punctuation.")
        return value


# --- Roles ------------------------------------------------------------------


class PermissionOut(ApiModel):
    key: str
    label: str
    description: str


class PermissionGroupOut(ApiModel):
    key: str
    label: str
    permissions: list[PermissionOut]


class RoleWrite(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(None, max_length=500)
    permissions: list[str] = []

    @field_validator("permissions")
    @classmethod
    def _known_permissions(cls, values: list[str]) -> list[str]:
        unknown = [v for v in values if not perms.is_valid(v)]
        if unknown:
            raise ValueError(f"Unknown permissions: {', '.join(unknown)}")
        # The wildcard belongs to the seeded super-admin role alone. A role
        # anyone can create must not be able to grant itself everything,
        # including the right to edit roles.
        if perms.WILDCARD in values:
            raise ValueError("Full access cannot be granted to a custom role.")
        return perms.normalise(values)


class RoleOut(ApiModel):
    id: int
    slug: str
    name: str
    description: str | None
    permissions: list[str]
    is_system: bool
    staff_count: int = 0


# --- Staff ------------------------------------------------------------------


class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone: str | None = Field(None, max_length=20)
    role_id: int
    password: str = Field(min_length=10, max_length=200)
    is_active: bool = True


class StaffUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    role_id: int | None = None
    is_active: bool | None = None


class StaffPasswordReset(BaseModel):
    new_password: str = Field(min_length=10, max_length=200)


class StaffOut(ApiModel):
    id: int
    name: str
    email: str
    phone: str | None
    role: RoleSummary
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


# --- Customer auth ----------------------------------------------------------


class OtpRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=15)


class OtpVerify(BaseModel):
    phone: str = Field(min_length=10, max_length=15)
    code: str = Field(min_length=4, max_length=8)
    name: str | None = Field(None, max_length=160)


class CustomerAuthResponse(ApiModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    customer: "CustomerOut"


class OtpRequestResponse(ApiModel):
    message: str
    expires_in: int
    # Populated only when SMS_PROVIDER=console and APP_ENV=local, so a
    # developer never has to dig the code out of a log. It is impossible for
    # this to be set in any other environment - see the auth route.
    dev_code: str | None = None


class CustomerOut(ApiModel):
    id: int
    name: str | None
    phone: str
    email: str | None
    is_active: bool
    created_at: datetime


class CustomerProfileUpdate(BaseModel):
    # Phone is the account identifier and is deliberately absent: changing it
    # is an account transfer, not a profile edit.
    name: str | None = Field(None, max_length=160)
    email: EmailStr | None = None


class CustomerAdminRow(CustomerOut):
    order_count: int
    total_spend: float
    last_order_at: datetime | None


# --- Addresses --------------------------------------------------------------


class AddressWrite(BaseModel):
    kind: Literal["shipping", "billing"] = "shipping"
    label: str | None = Field(None, max_length=40)
    full_name: str = Field(min_length=2, max_length=160)
    phone: str = Field(min_length=10, max_length=20)
    line1: str = Field(min_length=3, max_length=240)
    line2: str | None = Field(None, max_length=240)
    landmark: str | None = Field(None, max_length=160)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    postal_code: str = Field(min_length=6, max_length=12)
    country: str = Field("IN", min_length=2, max_length=2)
    is_default: bool = False

    @field_validator("postal_code")
    @classmethod
    def _indian_pincode(cls, value: str) -> str:
        digits = value.strip()
        if not digits.isdigit() or len(digits) != 6:
            raise ValueError("Enter a six-digit PIN code.")
        return digits


class AddressOut(ApiModel):
    id: int
    kind: str
    label: str | None
    full_name: str
    phone: str
    line1: str
    line2: str | None
    landmark: str | None
    city: str
    state: str
    postal_code: str
    country: str
    is_default: bool


CustomerAuthResponse.model_rebuild()
