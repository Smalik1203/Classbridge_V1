import React, { useState } from 'react';
import { Form, Input, Switch, Alert, Descriptions, Tag, Space, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormModal } from '../../../shared/components/forms';
import { inventoryIssuesService } from '../services/inventoryService';

const { Text } = Typography;

/**
 * Return or mark-as-lost an issued item. Mirrors mobile ReturnInventoryModal.
 * Both flows reverse stock; deposits create a negative refund line; one-time
 * charges delete the original invoice line.
 */
export default function ReturnInventoryModal({
  open, onClose, schoolCode, issue, onReturned,
}) {
  if (!issue) return null;

  const item = issue.inventory_item;
  const itemName = item?.name || 'Unknown item';
  const isOverdue = issue.expected_return_date
    ? new Date(issue.expected_return_date) < new Date()
    : false;

  return (
    <ReturnModalInner
      key={issue.id}
      open={open}
      onClose={onClose}
      schoolCode={schoolCode}
      issue={issue}
      item={item}
      itemName={itemName}
      isOverdue={isOverdue}
      onReturned={onReturned}
    />
  );
}

function ReturnModalInner({ open, onClose, schoolCode, issue, item, itemName, isOverdue, onReturned }) {
  const [markAsLost, setMarkAsLost] = useState(false);

  // Reset markAsLost on open.
  React.useEffect(() => {
    if (open) setMarkAsLost(false);
  }, [open]);

  const handleSubmit = async (values) => {
    if (markAsLost && !values.return_notes?.trim()) {
      throw new Error('Return notes are required when marking an item as lost');
    }
    return inventoryIssuesService.returnIssue(schoolCode, issue.id, {
      return_notes: values.return_notes?.trim() || undefined,
      mark_as_lost: markAsLost,
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={markAsLost ? 'Mark Item as Lost' : 'Return Inventory Item'}
      okText={markAsLost ? 'Mark as Lost' : 'Return Item'}
      width={560}
      requiredMark={false}
      modalProps={{ okButtonProps: { danger: markAsLost } }}
      getInitialValues={() => ({})}
      onSubmit={handleSubmit}
      onSaved={onReturned}
      successMessage={markAsLost
        ? 'Marked as lost — quantity and fees reversed'
        : 'Returned — quantity and fees reversed'}
      errorMessage="Failed to process return"
    >
      {() => (<>
        <Descriptions
          size="small"
          column={1}
          bordered
          style={{ marginBottom: 12 }}
          items={[
            { key: 'name', label: 'Item', children: <><Text strong>{itemName}</Text> {item?.category && <Text type="secondary">— {item.category}</Text>}</> },
            { key: 'recipient', label: 'Issued To', children: issue.issued_to_name || '—' },
            { key: 'qty', label: 'Quantity', children: issue.quantity },
            { key: 'date', label: 'Issued On', children: dayjs(issue.issue_date).format('DD MMM YYYY') },
            ...(issue.expected_return_date ? [{
              key: 'return',
              label: 'Expected Return',
              children: (
                <Space>
                  {dayjs(issue.expected_return_date).format('DD MMM YYYY')}
                  {isOverdue && <Tag color="red">Overdue</Tag>}
                </Space>
              ),
            }] : []),
            ...(issue.charge_amount ? [{
              key: 'charge',
              label: 'Charge',
              children: (
                <Space>
                  <Text>₹{issue.charge_amount}</Text>
                  {issue.charge_type === 'deposit' && <Tag color="blue">Refundable deposit</Tag>}
                  {issue.charge_type === 'one_time' && <Tag>One-time</Tag>}
                </Space>
              ),
            }] : []),
            ...(issue.serial_number ? [{ key: 'sn', label: 'Serial #', children: issue.serial_number }] : []),
          ]}
        />

        <Form.Item label={`Return Notes ${markAsLost ? '(required)' : '(optional)'}`} name="return_notes">
          <Input.TextArea
            rows={3}
            placeholder={markAsLost ? 'Explain why the item is lost…' : 'Any notes about this return…'}
          />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <WarningOutlined style={{ color: '#f59e0b' }} />
              <Text>Mark as Lost</Text>
            </Space>
          }
          extra="Use when item cannot be returned (stolen, destroyed, etc.). Stock and fees are still reversed."
        >
          <Switch checked={markAsLost} onChange={setMarkAsLost} />
        </Form.Item>

        {markAsLost && (
          <Alert
            type="warning"
            showIcon
            message="Marking as lost is permanent"
            description="The issuance will be marked as lost. Stock will be added back and any related fee will be reversed."
            style={{ marginBottom: 8 }}
          />
        )}

        {issue.charge_amount > 0 && (
          <Alert
            type="info"
            showIcon
            message="What will be reversed"
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {item?.track_quantity && (
                  <li>Inventory quantity will be added back ({issue.quantity} unit{issue.quantity !== 1 ? 's' : ''})</li>
                )}
                {issue.charge_type === 'deposit' ? (
                  <li>Deposit will be refunded as a negative invoice line</li>
                ) : (
                  <li>One-time charge will be removed from the invoice</li>
                )}
              </ul>
            }
          />
        )}
      </>)}
    </FormModal>
  );
}
