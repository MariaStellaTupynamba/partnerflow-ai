from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for response/request schemas that serialize as camelCase JSON.

    Keeps Python fields snake_case (idiomatic) while the wire format matches the
    hand-written TypeScript types in packages/shared-types.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
