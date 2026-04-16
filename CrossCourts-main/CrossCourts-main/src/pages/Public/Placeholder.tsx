interface PlaceholderProps {
  title: string;
  description: string;
}

const Placeholder = ({ title, description }: PlaceholderProps) => {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-sm border border-stroke bg-white p-8 shadow-default dark:border-strokedark dark:bg-boxdark">
        <h1 className="mb-3 text-2xl font-semibold text-black dark:text-white">
          {title}
        </h1>
        <p className="text-body-color dark:text-bodydark">{description}</p>
      </div>
    </div>
  );
};

export default Placeholder;
