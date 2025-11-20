"""Remove display_name from departments

Revision ID: 224ca3a28c71
Revises: 345d0d279800
Create Date: 2025-11-13 09:00:14.935001

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '224ca3a28c71'
down_revision = '345d0d279800'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('departments', 'display_name')

def downgrade():
    op.add_column('departments', sa.Column('display_name', sa.String(length=100), nullable=False))